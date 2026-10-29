"""Remove comments/layout only; never rename terms, predicates or variables.

Keep separators between word tokens, after clause terminators, and between
symbol tokens. Quoted atoms are copied verbatim. Reject unsupported characters.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re

TOKEN = re.compile(r"\s+|%[^\n]*|'(?:[^'\\]|\\.)*'|[A-Za-z_][A-Za-z_0-9]*|[0-9]+|[!#$&*+\-./:<=>?@\\^~]+|[(),;{}\[\]|]")
WORD = re.compile(r'[A-Za-z_0-9]')
SYMBOL = re.compile(r'[!#$&*+\-./:<=>?@\\^~]')


def compact(source):
    tokens, pos = [], 0
    while pos < len(source):
        match = TOKEN.match(source, pos)
        if not match:
            raise ValueError(f'Unsupported input at offset {pos}')
        token = match.group()
        pos = match.end()
        if not token.isspace() and not token.startswith('%'):
            tokens.append(token)
    out, previous = [], ''
    for token in tokens:
        if previous:
            if previous == '.':
                out.append('\n')
            elif ((WORD.fullmatch(previous[-1]) and WORD.fullmatch(token[0])) or
                  (SYMBOL.fullmatch(previous[-1]) and SYMBOL.fullmatch(token[0]))):
                out.append(' ')
        out.append(token)
        previous = token
    return ''.join(out) + '\n'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    source = Path(args.source).read_text()
    result = compact(source)
    Path(args.output).write_text(result)
    print(json.dumps({'source_bytes': len(source.encode()), 'bundle_bytes': len(result.encode()),
                      'sha256': hashlib.sha256(result.encode()).hexdigest()}))


if __name__ == '__main__':
    main()
