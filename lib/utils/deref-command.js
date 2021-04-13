/*
 * @Author: xiaotian@tangping 
 * @Descriptions: 将缩写和简写转换为规范的命名名
 * @TodoList: 无
 * @Date: 2021-03-22 21:09:04 
 * @Last Modified by: xiaotian@tangping
 * @Last Modified time: 2021-04-13 20:45:27
 */
// de-reference abbreviations and shorthands into canonical command name

const { aliases, cmdList, plumbing } = require('../utils/cmd-list.js')

// 获取别名列表
const aliasNames = Object.keys(aliases)

// 获取所有可能的命令列表
const fullList = cmdList.concat(aliasNames).filter(c => !plumbing.includes(c))

// 获取所有可能的缩写列表
const abbrev = require('abbrev')
const abbrevs = abbrev(fullList)

module.exports = c => {
  // 类型检测
  if (!c || typeof c !== 'string')
    return ''

  // 驼峰转换
  if (c.match(/[A-Z]/))
    c = c.replace(/([A-Z])/g, m => '-' + m.toLowerCase())

  if (plumbing.indexOf(c) !== -1)
    return c

  // 别名递归解析
  // first deref the abbrev, if there is one
  // then resolve any aliases
  // so `npm install-cl` will resolve to `install-clean` then to `ci`
  let a = abbrevs[c]
  while (aliases[a])
    a = aliases[a]

  return a || ''
}
