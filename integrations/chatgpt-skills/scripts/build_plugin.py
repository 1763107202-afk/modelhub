#!/usr/bin/env python3
"""Validate and package the instruction-only plugin. Does not install or deploy it."""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import stat
import zipfile

import yaml

ROOT = Path(__file__).resolve().parents[1]
SCHEMA = 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json'
EXPECTED = {
    'taste': 'design-taste-frontend',
    'agent_reach': 'agent-reach-research',
    'archify': 'archify-system-diagrams',
    'voicestudio': 'voicestudio-audio',
    'mirofish': 'mirofish-simulation',
    'anatomy': 'anatomy',
    'scientific_agent_research': 'scientific-agent-research',
    'nature_academic_workflows': 'nature-academic-workflows',
    'academic_research_critique': 'academic-research-critique',
    'fluent_cfd_review': 'fluent-cfd-review',
    'engineering_simulation': 'engineering-simulation',
    'solidworks_cad_bridge': 'solidworks-cad-bridge',
    'unity_vr_bridge': 'unity-vr-bridge',
    'blender_modeling_bridge': 'blender-modeling-bridge',
    'literature_evidence_search': 'literature-evidence-search',
    'cn_patent_disclosure': 'cn-patent-disclosure',
    'academic_presentation': 'academic-presentation',
    'scientific_paper_figures': 'scientific-paper-figures',
    'peer_review_response': 'peer-review-response',
    'research_automation_planning': 'research-automation-planning',
    'paper_to_patent_review': 'paper-to-patent-review',
    'anti_defensive_writing': 'anti-defensive-writing',
}


def validate(root):
    manifest = json.loads((root/'plugin.json').read_text(encoding='utf-8'))
    overlay = json.loads((root/'.codex-plugin/plugin.json').read_text(encoding='utf-8'))
    assert manifest['$schema'] == SCHEMA
    assert manifest['name'] == 'engineering-five-skills'
    assert re.fullmatch(r'(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)', manifest['version'])
    assert not ({'skills', 'mcpServers', 'apps', 'interface'} & manifest.keys())
    interface = manifest['extensions']['com.openai']['interface']
    assert interface == overlay['interface'], 'Portable and compatibility presentation differ'
    for field in ['displayName', 'shortDescription', 'longDescription', 'developerName', 'category']:
        assert isinstance(interface[field], str) and interface[field].strip(), field
    assert interface['displayName'] == 'Engineering Research Suite'
    assert len(interface['shortDescription']) <= 30
    assert interface['capabilities'] == [], 'Instruction-only package declares no tool capabilities'
    prompts = interface['defaultPrompt']
    assert isinstance(prompts, (str, list))
    if isinstance(prompts, list):
        assert 1 <= len(prompts) <= 3 and all(isinstance(p, str) and p.strip() for p in prompts)
    else:
        assert prompts.strip()
    assert overlay['name'] == manifest['name'] and overlay['version'] == manifest['version']
    assert overlay['skills'] == './skills/'
    assert not any((root/p).exists() for p in ['mcp.json', '.mcp.json', '.app.json'])
    assert not manifest['extensions']['com.openai'].get('apps')
    registry = json.loads((root/'registry.json').read_text(encoding='utf-8'))
    assert registry['package_version'] == manifest['version']
    assert {p['key']: p['skill'] for p in registry['providers']} == EXPECTED
    actual = sorted(p.parent.name for p in (root/'skills').glob('*/SKILL.md'))
    assert actual == sorted(EXPECTED.values()), actual
    for provider in registry['providers']:
        assert provider['instruction_status'] == 'available'
        assert provider['runtime_status'] == 'not_connected'
        skill = provider['skill']
        assert provider['skill_path'] == f'skills/{skill}/SKILL.md'
        path = root/provider['skill_path']
        assert path.stat().st_size <= 1024*1024
        content = path.read_text(encoding='utf-8')
        front = re.match(r'^---\n(.*?)\n---\n(.*)', content, re.S)
        assert front, path
        metadata = yaml.safe_load(front[1])
        assert set(metadata) == {'name', 'description'}
        assert metadata['name'] == skill and re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', skill)
        assert isinstance(metadata['description'], str) and metadata['description'].strip()
        assert front[2].strip()
        agent = yaml.safe_load((path.parent/'agents/openai.yaml').read_text())
        assert isinstance(agent, dict)
        ui = agent['interface']
        assert all(isinstance(ui[k], str) and ui[k].strip() for k in ['display_name', 'short_description', 'default_prompt'])
        assert '$'+skill in ui['default_prompt']
        assert set(agent.get('policy', {})) <= {'products', 'allow_implicit_invocation'}
        assert set(agent.get('dependencies', {})) <= {'tools'}
    return manifest


def package(destination):
    manifest = validate(ROOT)
    destination = destination.resolve()
    assert ROOT not in destination.parents, 'Write archives outside the plugin directory'
    destination.parent.mkdir(parents=True, exist_ok=True)
    paths = [ROOT/p for p in ['plugin.json', '.codex-plugin/plugin.json', 'registry.json', 'README.md', 'PLUGIN_CREATOR_SETUP.md']]
    paths += sorted(p for p in (ROOT/'skills').rglob('*') if p.is_file())
    with zipfile.ZipFile(destination, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
        for path in paths:
            assert not path.is_symlink()
            archive.write(path, manifest['name']+'/'+path.relative_to(ROOT).as_posix())
    with zipfile.ZipFile(destination) as archive:
        assert archive.testzip() is None
        names = archive.namelist()
        assert len(names) == len(set(names))
        for item in archive.infolist():
            parts = PurePosixPath(item.filename).parts
            assert parts[0] == manifest['name'] and '..' not in parts
            assert not PurePosixPath(item.filename).is_absolute()
            assert not stat.S_ISLNK(item.external_attr >> 16)
            assert not any(p in {'gateway', 'node_modules', '.git', '__pycache__', '.env'} for p in parts)
        assert sum(n.endswith('/SKILL.md') for n in names) == len(EXPECTED)
        assert sum(n.endswith('/agents/openai.yaml') for n in names) == len(EXPECTED)
        packed_manifest = json.loads(archive.read(manifest['name']+'/plugin.json'))
        assert packed_manifest == manifest
    return {'archive': str(destination), 'sha256': hashlib.sha256(destination.read_bytes()).hexdigest(), 'files': len(paths), 'skills': len(EXPECTED), 'runtime_connections': 0, 'version': manifest['version']}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    if args.output:
        print(json.dumps(package(args.output), ensure_ascii=False, indent=2))
    else:
        data = validate(ROOT)
        print(json.dumps({'status': 'compatibility_preflight_passed', 'version': data['version'], 'skills': len(EXPECTED), 'runtime_connections': 0}))
