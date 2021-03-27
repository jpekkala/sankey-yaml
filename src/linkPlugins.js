exports.handleLinkValue = function(link, valueProp) {
    const plugin = valueProp.plugin
    if (!plugin) {
        throw Error('Prop "plugin" missing in value declaration')
    }

    throw Error(`Unknown plugin ${plugin}`)
}
