/*
 * @Author: xiaotian@tangping 
 * @Descriptions: 将 arg 参数中的 auth 信息隐藏
 * @TodoList: 无
 * @Date: 2021-04-08 20:50:25 
 * @Last Modified by: xiaotian@tangping
 * @Last Modified time: 2021-04-08 20:51:17
 */

const URL = require('url').URL

// replaces auth info in an array of arguments or in a strings
function replaceInfo (arg) {

  /*
   * arg 类型判断，不符合则直接返回
   */ 
  const isArray = Array.isArray(arg)
  const isString = str => typeof str === 'string'

  if (!isArray && !isString(arg))
    return arg

  /*
   * 隐藏 url 中的 password 部分 
   */ 
  const testUrlAndReplace = str => {
    try {
      const url = new URL(str)
      return url.password === '' ? str : str.replace(url.password, '***')
    } catch (e) {
      return str
    }
  }

  // args 转换为数组
  const args = isString(arg) ? arg.split(' ') : arg

  // 将 args 参数中 url 的 password 部分隐藏
  const info = args.map(a => {
    if (isString(a) && a.indexOf(' ') > -1)
      return a.split(' ').map(testUrlAndReplace).join(' ')

    return testUrlAndReplace(a)
  })

  // 返回格式化后的参数
  return isString(arg) ? info.join(' ') : info
}

module.exports = replaceInfo
