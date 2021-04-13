/*
 * @Author: xiaotian@tangping 
 * @Descriptions: 监听并计算操作时长
 * @TodoList: 无
 * @Date: 2021-03-18 20:59:00 
 * @Last Modified by: xiaotian@tangping
 * @Last Modified time: 2021-04-13 20:27:08
 */

const log = require('npmlog')
const timings = new Map()

// 监听 time 设置事件，记录开始时间
process.on('time', (name) => {
  timings.set(name, Date.now())
})

// 监听 time 设置事件，记录开始时间
process.on('timeEnd', (name) => {
  if (timings.has(name)) {
    // 计算耗时
    const ms = Date.now() - timings.get(name)
    // 触发 timing 事件
    process.emit('timing', name, ms)
    // log 打印
    log.timing(name, `Completed in ${ms}ms`)
    // 删除对应记录
    timings.delete(name)
  } else
    log.silly('timing', "Tried to end timer that doesn't exist:", name)
})
