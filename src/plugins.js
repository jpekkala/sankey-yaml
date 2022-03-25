exports.callLinkPlugin = function(link, valueProp) {
    const { plugin: pluginName } = valueProp
    if (!pluginName) {
        throw Error('Prop "plugin" missing in value declaration')
    }

    throw Error(`Unknown plugin ${ pluginName }`)
}
