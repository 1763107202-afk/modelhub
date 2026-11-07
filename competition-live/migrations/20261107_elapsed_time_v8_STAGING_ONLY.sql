-- MOVE.ARENA V8 | STAGING-ONLY MIGRATION (DO NOT RUN ON PRODUCTION WITHOUT APPROVAL)
-- Backup and test this entire transaction on a SEPARATE Supabase project first.
-- Compatibility release: retain the existing six-argument comp26_action for old phones.
-- The new page calls comp26_action_v8; live scores with missing historical times require authorized backfill.
BEGIN;
ALTER TABLE public.comp26_teams
  ADD COLUMN IF NOT EXISTS elapsed_ms integer,
  ADD COLUMN IF NOT EXISTS elapsed_source text;

DO $constraints$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='comp26_elapsed_range' AND conrelid='public.comp26_teams'::regclass) THEN
    ALTER TABLE public.comp26_teams ADD CONSTRAINT comp26_elapsed_range CHECK (elapsed_ms IS NULL OR (elapsed_ms BETWEEN 10 AND 600000 AND elapsed_ms % 10 = 0));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='comp26_elapsed_source_valid' AND conrelid='public.comp26_teams'::regclass) THEN
    ALTER TABLE public.comp26_teams ADD CONSTRAINT comp26_elapsed_source_valid CHECK (elapsed_source IS NULL OR elapsed_source IN ('stopwatch','manual'));
  END IF;
END;
$constraints$;

-- Preserve legacy RPC unchanged. Use a distinct name to avoid PostgREST overload ambiguity.
CREATE OR REPLACE FUNCTION public.comp26_action_v8(p_secret text, p_action text, p_team_id uuid DEFAULT NULL::uuid, p_score numeric DEFAULT NULL::numeric, p_note text DEFAULT NULL::text, p_tie integer DEFAULT NULL::integer, p_elapsed_ms integer DEFAULT NULL::integer, p_time_source text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_auth record; v_event public.comp26_events%rowtype; v_team public.comp26_teams%rowtype;
  v_old jsonb; v_new jsonb; v_count integer; v_score_1 numeric; v_score_2 numeric; v_time_1 integer; v_time_2 integer; v_cut integer;
  v_next_a text; v_next_b text; v_remaining integer; v_action text := lower(trim(coalesce(p_action,'')));
begin
  if length(coalesce(p_secret,'')) < 24 or length(p_secret)>256 then raise exception '访问码不正确'; end if;
  select event_id,role into v_auth from public.comp26_tokens
    where secret_hash = pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_secret, 'UTF8')), 'hex') limit 1;
  if not found then raise exception '访问码不正确'; end if;
  select * into v_event from public.comp26_events where id=v_auth.event_id for update;
  if not found then raise exception '比赛尚未初始化'; end if;
  if v_action in ('start','next','activate_retry','retry_fail','finish_retries','mark_dnf','tie','reveal','announce','set_time')
     and v_auth.role <> 'admin' then raise exception '无管理员权限'; end if;
  if v_action in ('submit','fault','activate_retry','retry_fail','mark_dnf','tie','set_time') then
    select * into v_team from public.comp26_teams where id=p_team_id and event_id=v_event.id for update;
    if not found then raise exception '队伍不在本次赛事中'; end if;
  end if;
  v_old := case when v_action in ('submit','fault','activate_retry','retry_fail','mark_dnf','tie','set_time') then to_jsonb(v_team) else to_jsonb(v_event) end;
  if v_action = 'start' then
    if v_event.phase <> 'upcoming' then raise exception '比赛已开始，无法重复开赛'; end if;
    update public.comp26_events set phase='live', current_round=1, round_started_at=now(),
      announcement='第一轮比赛开始！请哈雪大帽险和稀有队就位', updated_at=now() where id=v_event.id;
  elsif v_action = 'submit' then
    if p_elapsed_ms is null or p_elapsed_ms<10 or p_elapsed_ms>600000 then raise exception '请先记录有效用时（0.01-600秒）'; end if;
    if p_elapsed_ms%10<>0 then raise exception '用时精度应为0.01秒'; end if;
    if p_time_source not in ('stopwatch','manual') or p_time_source is null then raise exception '计时来源不正确'; end if;
    if p_time_source='manual' and length(trim(coalesce(p_note,'')))=0 then raise exception '手工调整用时必须填写说明'; end if;
    if v_auth.role not in ('admin',case when v_team.lane='A' then 'judge_a' else 'judge_b' end) then raise exception '只能录入对应赛道分数'; end if;
    if p_score is null or p_score<0 or p_score>9999 then raise exception '请输入0到9999之间的分数'; end if;
    if v_event.phase='live' and v_team.round_no=v_event.current_round and v_team.status in ('pending','scored') then
      update public.comp26_teams set score=round(p_score,2),elapsed_ms=p_elapsed_ms,elapsed_source=p_time_source,tie_order=null,status='scored',note=left(coalesce(p_note,''),240),scored_at=now() where id=v_team.id;
    elsif v_event.phase='retry' and v_team.id=v_event.active_retry_team and v_team.status='retry_active' and v_team.attempt_count=2 then
      update public.comp26_teams set score=round(p_score,2),elapsed_ms=p_elapsed_ms,elapsed_source=p_time_source,tie_order=null,status='retry_scored',note=left(coalesce(p_note,''),240),scored_at=now() where id=v_team.id;
      update public.comp26_events set active_retry_team=null, announcement='补赛成绩已确认',updated_at=now() where id=v_event.id;
    else raise exception '当前队伍不处于可录分状态'; end if;
  elsif v_action = 'set_time' then
    if v_event.awards_revealed or v_event.phase in ('awards','closed') then raise exception '已公布成绩不允许补录用时'; end if;
    if v_team.score is null or v_team.status='dnf' then raise exception '该队伍暂无可补录用时的已确认成绩'; end if;
    if p_elapsed_ms is null or p_elapsed_ms<10 or p_elapsed_ms>600000 or p_elapsed_ms%10<>0 then raise exception '用时格式不正确（0.01—600秒）'; end if;
    if length(trim(coalesce(p_note,'')))<2 then raise exception '补录用时必须说明计时依据'; end if;
    update public.comp26_teams set elapsed_ms=p_elapsed_ms,elapsed_source='manual',tie_order=null,
      note=left(coalesce(v_team.note,'') || ' [管理员补录计时] ' || trim(p_note),240)
      where id=v_team.id;
  elsif v_action = 'fault' then
    if v_auth.role not in ('admin',case when v_team.lane='A' then 'judge_a' else 'judge_b' end) then raise exception '只能申报对应赛道故障'; end if;
    if v_event.phase <> 'live' or v_team.round_no <> v_event.current_round or v_team.status <> 'pending' then raise exception '只有当前未评分队伍可申请故障顺延'; end if;
    update public.comp26_teams set status='fault_pending',note=left(coalesce(p_note,'设备临时故障'),240) where id=v_team.id;
  elsif v_action = 'mark_dnf' then
    if v_event.phase='live' and v_team.round_no=v_event.current_round and v_team.status in ('pending','fault_pending') then
      update public.comp26_teams set score=0,elapsed_ms=null,elapsed_source=null,status='dnf',note='现场未完成/弃赛',scored_at=now() where id=v_team.id;
    elsif v_event.phase='retry' and v_team.status in ('fault_pending','retry_active') then
      update public.comp26_teams set score=0,elapsed_ms=null,elapsed_source=null,status='dnf',note='未完成补赛',scored_at=now() where id=v_team.id;
      if v_event.active_retry_team=v_team.id then update public.comp26_events set active_retry_team=null where id=v_event.id; end if;
    else raise exception '该队伍当前不能标记未完成'; end if;
  elsif v_action = 'next' then
    if v_event.phase <> 'live' then raise exception '当前不在正赛阶段'; end if;
    select count(*) into v_remaining from public.comp26_teams where event_id=v_event.id and round_no=v_event.current_round and status not in ('scored','fault_pending','dnf');
    if v_remaining>0 then raise exception '本轮还有队伍未录分或未记录故障，不能切换'; end if;
    if v_event.current_round<18 then
      select max(name) filter (where lane='A'),max(name) filter (where lane='B') into v_next_a,v_next_b
        from public.comp26_teams where event_id=v_event.id and round_no=v_event.current_round+1;
      update public.comp26_events set current_round=current_round+1,round_started_at=now(),updated_at=now(),
        announcement='有请第'||(v_event.current_round+1)||'轮：'||v_next_a||'、'||v_next_b||'！' where id=v_event.id;
    else
      select count(*) into v_remaining from public.comp26_teams where event_id=v_event.id and status='fault_pending';
      update public.comp26_events set phase=case when v_remaining>0 then 'retry' else 'review' end,
        announcement=case when v_remaining>0 then '正赛结束，进入硬件故障补赛环节' else '正赛结束，正在统计核对成绩' end,updated_at=now() where id=v_event.id;
    end if;
  elsif v_action = 'activate_retry' then
    if v_event.phase <> 'retry' or v_event.active_retry_team is not null then raise exception '尚不能安排下一支补赛队伍'; end if;
    if v_team.status <> 'fault_pending' or v_team.attempt_count<>1 then raise exception '该队伍没有可用的唯一补赛机会'; end if;
    update public.comp26_teams set status='retry_active',attempt_count=2,elapsed_ms=null,elapsed_source=null where id=v_team.id;
    update public.comp26_events set active_retry_team=v_team.id,announcement='补赛：'||v_team.name||'，请到'||v_team.lane||'赛道准备',updated_at=now() where id=v_event.id;
  elsif v_action = 'retry_fail' then
    if v_event.phase <> 'retry' or v_team.id<>v_event.active_retry_team or v_team.status<>'retry_active' then raise exception '当前不是该队伍的补赛'; end if;
    update public.comp26_teams set score=0,elapsed_ms=null,elapsed_source=null,status='dnf',scored_at=now(),note='补赛未完成' where id=v_team.id;
    update public.comp26_events set active_retry_team=null,announcement='补赛结束',updated_at=now() where id=v_event.id;
  elsif v_action = 'finish_retries' then
    if v_event.phase <> 'retry' then raise exception '不在补赛阶段'; end if;
    select count(*) into v_remaining from public.comp26_teams where event_id=v_event.id and status in ('fault_pending','retry_active');
    if v_remaining>0 then raise exception '仍有故障队伍等待处理'; end if;
    update public.comp26_events set phase='review',announcement='补赛结束，正在核对获奖名单',updated_at=now() where id=v_event.id;
  elsif v_action = 'tie' then
    if v_event.phase <> 'review' then raise exception '只可在成绩核对阶段设置同分裁决序'; end if;
    if v_team.score is null then raise exception '该队伍没有成绩'; end if;
    if p_tie is not null and (p_tie<1 or p_tie>36) then raise exception '同分裁决序必须为1—36'; end if;
    update public.comp26_teams set tie_order=p_tie where id=v_team.id;
  elsif v_action = 'reveal' then
    if v_event.phase <> 'review' or v_event.awards_revealed then raise exception '尚不能公布奖项'; end if;
    select count(*) into v_remaining from public.comp26_teams where event_id=v_event.id and score is null;
    if v_remaining>0 then raise exception '仍有未确认成绩，不能公布奖项'; end if;
    select count(*) into v_remaining from public.comp26_teams
      where event_id=v_event.id and score is not null and status<>'dnf' and elapsed_ms is null;
    if v_remaining>0 then raise exception '仍有已完成队伍未录入用时，不允许公布奖项'; end if;
    for v_cut in select unnest(array[3,10,18]) loop
      select score,elapsed_ms into v_score_1,v_time_1 from public.comp26_teams where event_id=v_event.id order by score desc,elapsed_ms asc nulls last,tie_order asc nulls last,draw_order asc offset v_cut-1 limit 1;
      select score,elapsed_ms into v_score_2,v_time_2 from public.comp26_teams where event_id=v_event.id order by score desc,elapsed_ms asc nulls last,tie_order asc nulls last,draw_order asc offset v_cut limit 1;
      if v_score_1=v_score_2 and v_time_1 is not distinct from v_time_2 then
        select count(*) into v_remaining from public.comp26_teams where event_id=v_event.id and score=v_score_1 and elapsed_ms is not distinct from v_time_1 and tie_order is null;
        if v_remaining>0 then raise exception '获奖档位交界处存在同分，必须先由裁判确定同分裁决序'; end if;
      end if;
    end loop;
    update public.comp26_events set awards_revealed=true,phase='awards',announcement='获奖名单正式揭晓！',updated_at=now() where id=v_event.id;
  elsif v_action = 'probe' then
    return pg_catalog.jsonb_build_object('ok',true,'role',v_auth.role);
  elsif v_action = 'announce' then
    if length(trim(coalesce(p_note,'')))=0 then raise exception '请输入公告内容'; end if;
    update public.comp26_events set announcement=left(trim(p_note),100),updated_at=now() where id=v_event.id;
  else raise exception '不支持的操作';
  end if;
  v_new:=case when v_action in ('submit','fault','activate_retry','retry_fail','mark_dnf','tie','set_time')
    then (select to_jsonb(t) from public.comp26_teams t where t.id=p_team_id)
    else (select to_jsonb(e) from public.comp26_events e where e.id=v_event.id) end;
  insert into public.comp26_audit(event_id,actor_role,action,team_id,before_data,after_data)
    values(v_event.id,v_auth.role,v_action,p_team_id,v_old,v_new);
  return pg_catalog.jsonb_build_object('ok',true,'action',v_action,'event_id',v_event.id);
end;$function$;

REVOKE ALL ON FUNCTION public.comp26_action_v8(text,text,uuid,numeric,text,integer,integer,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comp26_action_v8(text,text,uuid,numeric,text,integer,integer,text) TO anon, authenticated;
CREATE OR REPLACE FUNCTION public.comp26_reset(p_secret text, p_confirmation text, p_expected_scores integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_auth record;
 v_event public.comp26_events%rowtype;
 v_score_count integer;
 v_team_count integer;
 v_data jsonb;
 v_snapshot uuid;
begin
 if pg_catalog.length(coalesce(p_secret,'')) < 24
    or pg_catalog.length(p_secret) > 256 then
    raise exception '访问码不正确';
 end if;
 select event_id,role into v_auth
 from public.comp26_tokens
 where secret_hash = pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_secret,'UTF8')),'hex')
 limit 1;
 if not found or v_auth.role <> 'admin' then raise exception '只有管理员可以重置赛事'; end if;
 if p_confirmation is distinct from '清空测试成绩' then raise exception '请输入指定确认文字：清空测试成绩'; end if;
 select * into v_event from public.comp26_events
 where id=v_auth.event_id and slug='smart-cart-2026' for update;
 if not found then raise exception '目标赛事不存在'; end if;
 if v_event.awards_revealed or v_event.phase in ('awards','closed') then
    raise exception '奖项已公布或赛事已结束，不允许直接重置';
 end if;
 if (pg_catalog.now() at time zone 'Asia/Shanghai')::date >= v_event.event_day
    and (v_event.current_round>1 or v_event.phase in ('retry','review')) then
    raise exception '正式比赛日赛事已进入后续轮次，不允许清空全部成绩';
 end if;
 select pg_catalog.count(*) filter(where t.score is not null),pg_catalog.count(*),
        coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(t) order by t.draw_order),'[]'::jsonb)
 into v_score_count,v_team_count,v_data
 from public.comp26_teams t where t.event_id=v_event.id;
 if v_team_count <> 36 then raise exception '当前参赛队伍数量异常，拒绝重置'; end if;
 if p_expected_scores is null or p_expected_scores <> v_score_count then
    raise exception '已有成绩数量发生变化，请先刷新后台后再确认（当前：%队）',v_score_count;
 end if;
 insert into public.comp26_reset_snapshots(event_id,actor_role,event_data,teams_data,scored_count)
 values(v_event.id,'admin',pg_catalog.to_jsonb(v_event),v_data,v_score_count)
 returning id into v_snapshot;
 update public.comp26_teams set
 score=null,elapsed_ms=null,elapsed_source=null,status='pending',attempt_count=1,tie_order=null,note=null,scored_at=null
 where event_id=v_event.id;
 update public.comp26_events set
 current_round=1,phase='upcoming',awards_revealed=false,active_retry_team=null,
 round_started_at=null,announcement='欢迎参加智能搬运小车校内赛，请第一轮队伍提前准备',
 updated_at=pg_catalog.now()
 where id=v_event.id;
 insert into public.comp26_audit(event_id,actor_role,action,before_data,after_data)
 values(v_event.id,'admin','reset_test_scores',
  pg_catalog.jsonb_build_object('snapshot_id',v_snapshot,'scored_count',v_score_count,'event',pg_catalog.to_jsonb(v_event)),
  pg_catalog.jsonb_build_object('phase','upcoming','current_round',1,'cleared_scores',v_score_count));
 return pg_catalog.jsonb_build_object('ok',true,'cleared',v_score_count,
  'teams_preserved',v_team_count,'phase','upcoming','round',1,'snapshot_id',v_snapshot);
end;
$function$;

COMMIT;
