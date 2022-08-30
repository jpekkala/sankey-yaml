module.exports = {
    'env': {
        'browser': true,
        'commonjs': true,
        'es2021': true,
        'mocha': true
    },
    'extends': 'eslint:recommended',
    'overrides': [
    ],
    'parserOptions': {
        'ecmaVersion': 'latest'
    },
    'rules': {
        'indent': [
            'error',
            4, {
                'MemberExpression': 'off'
            }
        ],
        'linebreak-style': [
            'error',
            'unix'
        ],
        'quotes': [
            'error',
            'single'
        ],
        'semi': [
            'error',
            'never'
        ],
    }
}
