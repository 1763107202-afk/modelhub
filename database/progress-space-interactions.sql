-- 实验室进度空间：评论、回复、未读和点赞
-- 仅供网站实际生产项目执行；请勿在其他 Supabase 项目执行。
-- 原 progress_updates / team_progress_updates 数据保持原样，不做迁移、删除或改写。

create table if not exists public.progress_space_comments (
  id uuid primary key default gen_random_uuid(),
  progress_type text not null check (progress_type in ('personal','team')),
  progress_id uuid not null,
  author_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid references public.progress_space_comments(id) on delete cascade,
  content text not null check (char_length(btrim(content)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists progress_space_comments_post_idx
  on public.progress_space_comments(progress_type,progress_id,created_at);
create index if not exists progress_space_comments_recipient_idx
  on public.progress_space_comments(recipient_id,created_at desc);

create table if not exists public.progress_space_comment_reads (
  user_id uuid not null references auth.users(id) on delete cascade,
  comment_id uuid not null references public.progress_space_comments(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key(user_id,comment_id)
);

create table if not exists public.progress_space_likes (
  progress_type text not null check (progress_type in ('personal','team')),
  progress_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(progress_type,progress_id,user_id)
);
create index if not exists progress_space_likes_post_idx
  on public.progress_space_likes(progress_type,progress_id);

alter table public.progress_space_comments enable row level security;
alter table public.progress_space_comment_reads enable row level security;
alter table public.progress_space_likes enable row level security;

revoke all on public.progress_space_comments, public.progress_space_comment_reads, public.progress_space_likes from anon,authenticated;
grant select, insert, delete on public.progress_space_comments to authenticated;
grant select, insert on public.progress_space_comment_reads to authenticated;
grant select, insert, delete on public.progress_space_likes to authenticated;


-- 回复引用验证放在 private schema 中，以免评论表的 RLS 自引用产生递归错误。
-- 不返回评论内容，只判断引用是否匹配。
create or replace function private.space_reply_matches(
  p_parent uuid,p_type text,p_post uuid,p_recipient uuid
) returns boolean
language sql stable security definer
set search_path = ''
as $
  select exists (
    select 1 from public.progress_space_comments parent
    where parent.id=p_parent and parent.progress_type=p_type
      and parent.progress_id=p_post and parent.author_id=p_recipient
  )
$;
revoke all on function private.space_reply_matches(uuid,text,uuid,uuid) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.space_reply_matches(uuid,text,uuid,uuid) to authenticated;

-- 会员资格以服务器端 profiles 为准，不能信任客户端传来的成员角色。
create policy "space_comments_formal_read" on public.progress_space_comments
for select to authenticated using (
  exists (select 1 from public.profiles p where p.id=(select auth.uid())
    and (p.membership_status='formal' or p.role in ('admin','super_admin')))
);
create policy "space_comments_formal_insert" on public.progress_space_comments
for insert to authenticated with check (
  author_id=(select auth.uid())
  and exists (select 1 from public.profiles p where p.id=(select auth.uid())
    and (p.membership_status='formal' or p.role in ('admin','super_admin')))
  -- 评论必须引用真实存在的进度。
  and (
    (progress_type='personal' and exists (select 1 from public.progress_updates pu where pu.id=progress_id))
    or (progress_type='team' and exists (select 1 from public.team_progress_updates tu where tu.id=progress_id))
  )
  -- 评论发送给进度作者；回复发送给被回复的评论作者；禁止伪造收件人。
  and (
    (parent_id is null and (
      (progress_type='personal' and exists (select 1 from public.progress_updates pu
        where pu.id=progress_id and pu.user_id=recipient_id))
      or
      (progress_type='team' and exists (select 1 from public.team_progress_updates tu
        where tu.id=progress_id and tu.created_by=recipient_id))
    ))
    or
    (parent_id is not null and private.space_reply_matches(parent_id,progress_type,progress_id,recipient_id))
  )
);
create policy "space_comments_author_delete" on public.progress_space_comments
for delete to authenticated using (
  author_id=(select auth.uid()) or exists (
    select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='super_admin'
  )
);

create policy "space_reads_own_select" on public.progress_space_comment_reads
for select to authenticated using (user_id=(select auth.uid()));
create policy "space_reads_own_insert" on public.progress_space_comment_reads
for insert to authenticated with check (
  user_id=(select auth.uid()) and exists (
    select 1 from public.progress_space_comments c where c.id=comment_id and c.recipient_id=(select auth.uid())
  )
);

create policy "space_likes_formal_read" on public.progress_space_likes
for select to authenticated using (
  exists (select 1 from public.profiles p where p.id=(select auth.uid())
    and (p.membership_status='formal' or p.role in ('admin','super_admin')))
);
create policy "space_likes_own_insert" on public.progress_space_likes
for insert to authenticated with check (
  user_id=(select auth.uid())
  and exists (select 1 from public.profiles p where p.id=(select auth.uid())
    and (p.membership_status='formal' or p.role in ('admin','super_admin')))
  and (
    (progress_type='personal' and exists (select 1 from public.progress_updates pu where pu.id=progress_id))
    or (progress_type='team' and exists (select 1 from public.team_progress_updates tu where tu.id=progress_id))
  )
);
create policy "space_likes_own_delete" on public.progress_space_likes
for delete to authenticated using (user_id=(select auth.uid()));
