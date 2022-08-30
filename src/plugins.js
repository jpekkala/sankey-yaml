const {
    isFunction,
} = require('lodash')

const plugins = {}

exports.registerPlugin = function(name, pluginFn) {
    if (!isFunction(pluginFn)) {
        throw Error('pluginFn should be a function')
    }
    plugins[name] = pluginFn
}

exports.callLinkPlugin = function(link, valueProp) {
    const { plugin: pluginName } = valueProp
    if (!pluginName) {
        throw Error('Prop "plugin" missing in value declaration')
    }

    const pluginFn = plugins[pluginName]
    if (pluginFn) {
        return pluginFn(link, valueProp)
    }

    throw Error(`Unknown plugin ${ pluginName }`)
}
