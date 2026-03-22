import json
with open('package.json', 'r', encoding='utf-8') as f:
    data = json.load(f)
data['dependencies']['basic-auth'] = '^2.0.1'
with open('package.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2)
