"""Real LOCAL node diagnostic. Never uses an existing wallet or public chain.

No production Abstract installation, real secret enrollment, ZK or Telegram.
No resource-limit overrides. Source commitments c1/c2 are symbolic fixtures.
"""
import argparse
import base64
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
import subprocess
import tempfile
import time
import urllib.request


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--axoned', required=True)
    ap.add_argument('--gov-wasm', required=True)
    ap.add_argument('--report', required=True)
    ap.add_argument('--readable', action='store_true')
    args = ap.parse_args()
    cli, wasm, output = Path(args.axoned).resolve(), Path(args.gov_wasm).resolve(), Path(args.report)
    root = Path(__file__).resolve().parent.parent
    filename = 'constitution.pl' if args.readable else 'constitution.compact.pl'
    template = (root / 'experiments/compact-lifecycle' / filename).read_text()
    report = {'result': 'INCOMPLETE', 'date': datetime.now(timezone.utc).date().isoformat(), 'source': filename,
              'node_sha256': hashlib.sha256(cli.read_bytes()).hexdigest(),
              'gov_wasm_sha256': hashlib.sha256(wasm.read_bytes()).hexdigest(),
              'direct_instantiation_fixture': True, 'production_abstract_installation_tested': False,
              'real_commitment_enrollment': False, 'public_deployment': False, 'cases': []}

    def save():
        output.write_text(json.dumps(report, indent=2) + '\n')

    save()
    chain, rpc = 'axone-compact-local', 'http://127.0.0.1:28657'
    with tempfile.TemporaryDirectory(prefix='axone-compact-') as home:
        def run(*a, parse=False):
            # Key generation emits secret phrases: capture stdout, never print.
            r = subprocess.run([str(cli), *map(str, a), '--home', home],
                               capture_output=True, text=True, timeout=90)
            if r.returncode:
                raise RuntimeError(f'{a[:3]}: {r.stderr[:3500]}')
            return json.loads(r.stdout) if parse else r.stdout

        def denom(x):
            if isinstance(x, dict): return {k: denom(v) for k, v in x.items()}
            if isinstance(x, list): return [denom(v) for v in x]
            return 'uaxone' if x == 'stake' else x

        run('init', 'compact-local', '--chain-id', chain)
        addresses = {}
        for key in ['controller', 'validator', 'spectator']:
            run('keys', 'add', key, '--keyring-backend', 'test', '--output', 'json')
            addresses[key] = run('keys', 'show', key, '-a', '--keyring-backend', 'test').strip()
        genesis = Path(home) / 'config/genesis.json'
        data = denom(json.loads(genesis.read_text()))
        limits = data['app_state']['logic']['params']['limits']
        assert int(limits['max_size']) == 5000 and int(limits['max_variables']) == 100000, limits
        report['native_limits'] = limits
        genesis.write_text(json.dumps(data))  # Denomination only; no limit edits.
        for a in addresses.values():
            run('genesis', 'add-genesis-account', a, '1000000000000000uaxone')
        run('genesis', 'gentx', 'validator', '1000000000uaxone', '--keyring-backend', 'test', '--chain-id', chain)
        run('genesis', 'collect-gentxs')
        run('genesis', 'validate-genesis')
        cfg = Path(home) / 'config/config.toml'
        cfg.write_text(cfg.read_text().replace('timeout_commit = "5s"', 'timeout_commit = "1s"'))
        with (Path(home) / 'node.log').open('w+') as log:
            node = subprocess.Popen([str(cli), 'start', '--home', home,
                '--rpc.laddr', 'tcp://127.0.0.1:28657', '--p2p.laddr', 'tcp://127.0.0.1:28656',
                '--grpc.address', '127.0.0.1:29090', '--minimum-gas-prices', '0.025uaxone'], stdout=log, stderr=log)
            try:
                for _ in range(100):
                    try:
                        with urllib.request.urlopen(rpc + '/status', timeout=2) as response:
                            status = json.load(response)['result']
                        assert status['node_info']['network'] == chain
                        if int(status['sync_info']['latest_block_height']) >= 1: break
                    except OSError: pass
                    if node.poll() is not None:
                        log.seek(0); raise RuntimeError(log.read()[-3500:])
                    time.sleep(.3)
                else: raise RuntimeError('Node startup timeout')

                def tx(*a, key='controller', failure=False):
                    sent = run('tx', *a, '--node', rpc, '--chain-id', chain, '--from', key,
                        '--keyring-backend', 'test', '--gas', '3000000' if failure else 'auto',
                        '--gas-adjustment', '1.5', '--gas-prices', '0.025uaxone', '--yes', '--output', 'json', parse=True)
                    assert sent.get('code', 0) == 0, sent
                    for _ in range(100):
                        try: committed = run('query', 'tx', sent['txhash'], '--node', rpc, '--output', 'json', parse=True)
                        except RuntimeError: time.sleep(.3); continue
                        assert (committed.get('code', 0) != 0) == failure, committed
                        assert 'out of gas' not in committed.get('raw_log', '').lower(), committed
                        return committed
                    raise RuntimeError('Transaction commitment timeout')

                def attr(r, kind, name):
                    return next(a['value'] for e in r['events'] if e['type'] == kind
                                for a in e['attributes'] if a['key'] == name)

                def query(body):
                    return run('query', 'wasm', 'contract-state', 'smart', gov,
                               json.dumps({'module': body}), '--node', rpc, '--output', 'json', parse=True)['data']

                def logic(program, goal):
                    r = run('query', 'logic', 'ask', goal, '--program', program, '--node', rpc, '--output', 'json', parse=True)
                    answers = r['answer']['results']
                    assert answers and not any(x.get('error') for x in answers), r
                    return r

                uploaded = tx('wasm', 'store', wasm)
                code = attr(uploaded, 'store_code', 'code_id')
                bootstrap = "decide(_,'gov:permitted'). decide(_,'gov:permitted',local_bootstrap)."
                init = {'base': {'account': addresses['controller']}, 'module': {
                    'constitution': base64.b64encode(bootstrap.encode()).decode()}}
                receipt = tx('wasm', 'instantiate', code, json.dumps(init), '--label', 'compact-local-only', '--no-admin')
                gov = attr(receipt, 'instantiate', '_contract_address')
                program = template.replace('__GOV__', gov).replace('__CONTROLLER__', addresses['controller'])
                report.update(gov_address=gov, actor_addresses=addresses,
                              constitution_utf8_bytes=len(program.encode()),
                              constitution_sha256=hashlib.sha256(program.encode()).hexdigest())
                output.with_suffix('.constitution.pl').write_text(program)
                logic(program, 'current_predicate(decide/2).')
                replacement = base64.b64encode(program.encode()).decode()
                tx('wasm', 'execute', gov, json.dumps({'module': {'revise_constitution': {'constitution': replacement, 'case': None}}}))
                assert query({'constitution_status': {}})['constitution_revision'] == 1

                def records():
                    all_rows = query({'decisions': {'start_after': None, 'limit': 50}})['decisions']
                    assert len(all_rows) < 50
                    return all_rows

                def index():
                    rows = records()
                    for role in ['validator', 'spectator']:
                        page = query({'decisions_by_author': {'author': addresses[role], 'limit': 1, 'descending': True}})
                        assert page['decisions'] == [r for r in rows if r['author'] == addresses[role]][-1:]

                def case(intent, c='c1'):
                    return ("ctx{intent:'" + intent + "',commitment:" + c + ",actor:spoofed,previous_state:spoofed,"
                            "stake:spoofed,now:spoofed,'gov:module':spoofed,'cw:tx':spoofed}")

                snapshots, parents = {}, {}

                def act(role, intent, c, event, mode='carry'):
                    before = records()
                    receipt = tx('wasm', 'execute', gov, json.dumps({'module': {'record_decision': {'case': case(intent, c), 'motivated': True}}}), key=role)
                    after = records(); r = after[-1]
                    assert len(after) == len(before) + 1 and r['decision_id'] == before[-1]['decision_id'] + 1
                    assert r['author'] == addresses[role] and r['constitution_revision'] == 1
                    assert base64.b64decode(r['constitution_hash']).hex() == report['constitution_sha256']
                    for field in ['case', 'verdict', 'motivation']:
                        assert base64.b64decode(r[field + '_hash']) == hashlib.sha256(r[field].encode()).digest()
                    assert "'cw:tx':spoofed" not in r['case'].replace(' ', '')
                    s = snapshots.get(role, 's(none,read_only,none,none)')
                    now = int(r['block_time_seconds'])
                    if mode == 'grant': s = f's({c},eligible,none,{now+259200})'
                    if mode == 'grace': s = f's(c1,grace_period,{now},{now+259200})'
                    if mode == 'revoke': s = 's(c2,revoked,none,none)'
                    expected = f'entitlement_v1({addresses[role]},{parents.get(role,0)},{event},{s})'
                    assert r['verdict'].replace(' ', '') == expected, (r, expected)
                    snapshots[role], parents[role] = s, r['decision_id']
                    index()
                    report['cases'].append({'role': role, 'intent': intent, 'event': event, 'gas_used': receipt['gas_used'], 'record': r})
                    save(); print(f'PASS: {role}, {intent}, {event}', flush=True)

                def reject(label, body, role='spectator', revision=1):
                    before = records()
                    receipt = tx('wasm', 'execute', gov, json.dumps({'module': body}), key=role, failure=True)
                    assert records() == before
                    assert query({'constitution_status': {}})['constitution_revision'] == revision
                    index()
                    report['cases'].append({'case': label, 'committed_failure': True, 'code': receipt['code'], 'records_unchanged': True})
                    save(); print(f'PASS: {label}, committed failure, records unchanged', flush=True)

                index()
                act('spectator', 'qualify', 'c1', 'refused')
                act('validator', 'qualify', 'c1', 'admitted', 'grant')
                act('spectator', 'unrelated', 'c1', 'unchanged')
                act('spectator', 'gov:revise_constitution', 'c1', 'unchanged')
                operator = run('query', 'staking', 'validators', '--node', rpc, '--output', 'json', parse=True)['validators'][0]['operator_address']
                tx('staking', 'delegate', operator, '1000000000uaxone', key='spectator')
                act('spectator', 'qualify', 'c2', 'admitted', 'grant')
                act('spectator', 'qualify', 'c1', 'refused')
                act('spectator', 'unrelated', 'c1', 'unchanged')
                act('spectator', 'revoke', 'c2', 'revoked', 'revoke')
                act('validator', 'qualify', 'c1', 'renewed', 'grant')
                act('spectator', 'unrelated', 'c1', 'unchanged')
                act('spectator', 'qualify', 'c2', 'refused')
                act('spectator', 'qualify', 'c1', 'refused')
                act('spectator', 'gov:revise_constitution', 'c1', 'unchanged')
                act('spectator', 'gov:establish', 'c1', 'unchanged')
                tx('staking', 'unbond', operator, '1uaxone', key='validator')
                act('validator', 'qualify', 'c1', 'grace', 'grace')
                act('validator', 'qualify', 'c1', 'grace')
                act('validator', 'unrelated', 'c1', 'unchanged')
                act('validator', 'qualify', 'c2', 'refused')
                reject('oversized-intent', {'record_decision': {'case': case('x'*33), 'motivated': True}})
                reject('compound-commitment', {'record_decision': {'case': case('qualify', 'bad(c1)'), 'motivated': True}})
                reject('extra-field', {'record_decision': {'case': case('qualify').replace('ctx{','ctx{extra:bad,'), 'motivated': True}})
                reject('controller-cannot-enroll', {'record_decision': {'case': case('qualify'), 'motivated': True}}, 'controller')
                reject('participant-cannot-revise', {'revise_constitution': {'constitution': replacement, 'case': None}})
                tx('wasm', 'execute', gov, json.dumps({'module': {'record_decision': {'case': "ctx{intent:'gov:revise_constitution'}", 'motivated': True}}}))
                assert query({'constitution_status': {}})['constitution_revision'] == 1
                index()
                rows = records(); walks = 0
                for role in addresses:
                    for descending in [False, True]:
                        expected = [r for r in rows if r['author'] == addresses[role]]
                        expected.sort(key=lambda r:r['decision_id'], reverse=descending)
                        collected, cursor = [], None
                        for _ in range(len(rows)+1):
                            page = query({'decisions_by_author': {'author': addresses[role], 'start_after': cursor, 'limit': 2, 'descending': descending}})
                            collected += page['decisions']; cursor = page['next_start_after']
                            if cursor is None: break
                        else: raise AssertionError('Nonterminating cursor')
                        assert collected == expected; walks += 1
                tx('wasm', 'execute', gov, json.dumps({'module': {'revise_constitution': {'constitution': replacement, 'case': None}}}))
                reject('revision-disables-without-binding-reset', {'record_decision': {'case': case('qualify'), 'motivated': True}}, revision=2)
                report.update(result='PASS', participant_decisions=18, complete_page_walks=walks, final_records=records())
                save(); print('PASS: compact native lifecycle at default limits', flush=True)
            except Exception as error:
                report.update(result='BLOCKED', error=str(error)); save(); raise
            finally:
                node.terminate()
                try: node.wait(timeout=15)
                except subprocess.TimeoutExpired: node.kill(); node.wait(timeout=5)


if __name__ == '__main__': main()
