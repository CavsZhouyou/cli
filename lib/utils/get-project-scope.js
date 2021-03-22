/*
 * @Author: xiaotian@tangping 
 * @Descriptions: 获取项目的 scope 前缀
 * @TodoList: 无
 * @Date: 2021-03-22 20:46:57 
 * @Last Modified by:   xiaotian@tangping 
 * @Last Modified time: 2021-03-22 20:46:57 
 */
const { resolve } = require('path')
module.exports = prefix => {
  try {
    const { name } = require(resolve(prefix, 'package.json'))
    if (!name || typeof name !== 'string')
      return ''

    const split = name.split('/')
    if (split.length < 2)
      return ''

    const scope = split[0]
    return /^@/.test(scope) ? scope : ''
  } catch (er) {
    return ''
  }
}
