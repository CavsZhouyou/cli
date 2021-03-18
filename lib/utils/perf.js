/*
 * @Author: xiaotian@tangping 
 * @Descriptions: 监听并计算操作时长
 * @TodoList: 无
 * @Date: 2021-03-18 20:59:00 
 * @Last Modified by: xiaotian@tangping
 * @Last Modified time: 2021-03-18 20:59:51
 */

const log = require('npmlog')
const timings = new Map()

process.on('time', (name) => {
  timings.set(name, Date.now())
})

process.on('timeEnd', (name) => {
  if (timings.has(name)) {
    const ms = Date.now() - timings.get(name)
    process.emit('timing', name, ms)
    log.timing(name, `Completed in ${ms}ms`)
    timings.delete(name)
  } else
    log.silly('timing', "Tried to end timer that doesn't exist:", name)
})
