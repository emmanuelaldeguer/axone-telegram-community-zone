"""Unpatched-gov native assessment and fixed-height REST snapshot diagnostic."""
import base64
from datetime import datetime
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile
import urllib.request


def exercise_subject_wallet(tx, query, run, rpc, gov, program, addresses, report, save, root, output):
    report.update(upstream_gov_unmodified=True, author_index_used=False,
                  identity_commitment_in_case=False, policy_mode='strict-current-stake-no-grace')
    def rows():
        result = query({'decisions': {'start_after': None, 'limit': 50}})['decisions']
        assert len(result) < 50
        return result

    def case(subject):
        return ('ctx{intent:qualify_wallet_v1,regime:telegram_publish_strict_v1,'
                f'subject:{subject}}}')

    def assess(payer, subject, eligible, spoof=False):
        before = rows()
        body = case(addresses[subject])
        if spoof:
            body = body.replace('ctx{', "ctx{'cw:tx':spoofed,'gov:module':spoofed,")
        receipt = tx('wasm', 'execute', gov, json.dumps({'module': {'record_decision': {
            'case': body, 'motivated': True}}}), key=payer)
        after = rows(); record = after[-1]
        assert len(after) == len(before) + 1
        assert record['author'] == addresses[payer]
        assert record['constitution_revision'] == 1
        assert "'cw:tx':spoofed" not in record['case'].replace(' ', '')
        assert "'gov:module':spoofed" not in record['case'].replace(' ', '')
        assert base64.b64decode(record['constitution_hash']).hex() == report['constitution_sha256']
        for field in ['case', 'verdict', 'motivation']:
            assert base64.b64decode(record[field + '_hash']) == hashlib.sha256(record[field].encode()).digest()
        at = int(record['block_time_seconds']); until = at + 259200 if eligible else at
        status = 'eligible' if eligible else 'read_only'
        expected = f'wallet_entitlement_v1(telegram_publish_strict_v1,{addresses[subject]},{status},{at},{until})'
        assert record['verdict'].replace(' ', '') == expected
        report['cases'].append({'payer': payer, 'subject': subject, 'status': status,
                                'gas_used': receipt['gas_used'], 'record': record})
        save(); print(f'PASS: payer {payer}, subject {subject}, {status}', flush=True)

    def reject(label, body, payer='spectator'):
        before = rows()
        receipt = tx('wasm', 'execute', gov, json.dumps({'module': {'record_decision': {
            'case': body, 'motivated': True}}}), key=payer, failure=True)
        assert rows() == before
        report['cases'].append({'case': label, 'committed_failure': True,
                                'code': receipt['code'], 'records_unchanged': True})
        save(); print(f'PASS: {label}, no record', flush=True)

    assess('spectator', 'validator', True, spoof=True)
    assess('validator', 'spectator', False)
    assess('controller', 'validator', True)  # No reserved-controller exclusion.
    assess('spectator', 'spectator', False)
    operator = run('query', 'staking', 'validators', '--node', rpc, '--output', 'json', parse=True)['validators'][0]['operator_address']
    tx('staking', 'delegate', operator, '1000000000uaxone', key='spectator')
    assess('validator', 'spectator', True)
    tx('staking', 'unbond', operator, '1uaxone', key='spectator')
    assess('validator', 'spectator', False)
    assess('controller', 'spectator', False)
    assess('spectator', 'validator', True)
    for field, value in [('stake', '999999999999'), ('commitment', 'c1'),
                         ('challenge', 'bot_nonce'), ('telegram', 'user42')]:
        reject('caller-' + field, case(addresses['validator']).replace('ctx{', f'ctx{{{field}:{value},'))
    reject('invalid-subject', case('not_a_wallet'))
    reject('arbitrary-revocation', case(addresses['validator']).replace('qualify_wallet_v1', 'revoke_wallet'))
    reject('forged-governance', case(addresses['validator']).replace('qualify_wallet_v1', "'gov:revise_constitution'"))
    tx('wasm', 'execute', gov, json.dumps({'module': {'record_decision': {
        'case': f"ctx{{intent:'gov:revise_constitution',regime:telegram_publish_strict_v1,subject:{addresses['validator']}}}",
        'motivated': True}}}))
    assert query({'constitution_status': {}})['constitution_revision'] == 1

    with urllib.request.urlopen(rpc + '/status', timeout=10) as response:
        height = json.load(response)['result']['sync_info']['latest_block_height']
    with urllib.request.urlopen(rpc + '/block?height=' + height, timeout=10) as response:
        block = json.load(response)['result']
    header = block['block']['header']
    at = int(datetime.fromisoformat(header['time'].replace('Z', '+00:00')).timestamp())
    config = {'restUrl': 'http://127.0.0.1:29317', 'height': height, 'now': str(at),
              'window': {'start': str(at), 'end': str(at + 30)},
              'policy': {'chainId': header['chain_id'], 'govAddress': gov,
                         'codeChecksum': report['gov_wasm_sha256'], 'constitutionRevision': '1',
                         'constitutionHash': base64.b64encode(bytes.fromhex(report['constitution_sha256'])).decode(),
                         'maxSnapshotAgeSeconds': '60', 'maxLeaseSeconds': '30', 'pageLimit': 2, 'maxPages': 50},
              'expectedMembers': [addresses['validator']]}
    config['expectedBlockHash'] = block['block_id']['hash'].lower()
    with tempfile.TemporaryDirectory(prefix='subject-snapshot-') as d:
        path = Path(d) / 'config.json'; path.write_text(json.dumps(config))
        checked = subprocess.run(['node', str(root / 'tools/check-subject-snapshot.mjs'), str(path)],
                                 capture_output=True, text=True, timeout=90)
        assert checked.returncode == 0, checked.stderr
        snapshot = json.loads(checked.stdout)
        assert snapshot['members'] == config['expectedMembers']
        report['fixed_height_snapshot'] = snapshot
    report.update(result='PASS', participant_decisions=8,
                  failed_cases=7, final_records=rows())
    save(); print('PASS: subject wallets and REST snapshot via unpatched upstream gov', flush=True)
