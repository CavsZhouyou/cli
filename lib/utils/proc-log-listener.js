/*
 * @Author: xiaotian@tangping 
 * @Descriptions: log 的 listener，不太清楚为什么要在监听
 * @TodoList: 无
 * @Date: 2021-03-18 21:04:06 
 * @Last Modified by: xiaotian@tangping
 * @Last Modified time: 2021-03-18 21:04:37
 */

const log = require('npmlog')
const { inspect } = require('util')
module.exports = () => {
  process.on('log', (level, ...args) => {
    try {
      log[level](...args)
    } catch (ex) {
      try {
        // if it crashed once, it might again!
        log.verbose(`attempt to log ${inspect([level, ...args])} crashed`, ex)
      } catch (ex2) {
        console.error(`attempt to log ${inspect([level, ...args])} crashed`, ex)
      }
    }
  })
}
