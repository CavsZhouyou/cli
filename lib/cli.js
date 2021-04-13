/*
 * @Author: xiaotian@tangping 
 * @Descriptions:
 *     1. node 版本检查
 *     2. 进程错误监测
 *     3. TODO
 * @TodoList: 无
 * @Date: 2021-03-18 20:41:52 
 * @Last Modified by: xiaotian@tangping
 * @Last Modified time: 2021-04-13 20:22:56
 */

// Separated out for easier unit testing
module.exports = (process) => {

  /**
   * Node 版本检测和基础的 log 配置等
   */

  // 设置 title，避免配置泄露
  // set it here so that regardless of what happens later, we don't
  // leak any private CLI configs to other programs
  process.title = 'npm'

  const {
    checkForBrokenNode,
    checkForUnsupportedNode,
  } = require('../lib/utils/unsupported.js')

  checkForBrokenNode()

  const log = require('npmlog')
  // log 保存在缓存中，后面配置确定后，使用 log.resume 时一起输出
  // pause it here so it can unpause when we've loaded the configs
  // and know what loglevel we should be printing.
  log.pause()

  checkForUnsupportedNode()

  const npm = require('../lib/npm.js')
  const errorHandler = require('../lib/utils/error-handler.js')

  // 全局别名修改为参数
  // if npm is called as "npmg" or "npm_g", then
  // run in global mode.
  if (process.argv[1][process.argv[1].length - 1] === 'g')
    process.argv.splice(1, 1, 'npm', '-g')

  // 记录命令行参数
  log.verbose('cli', process.argv)

  // 版本打印
  log.info('using', 'npm@%s', npm.version)
  log.info('using', 'node@%s', process.version)

  // 添加异常错误处理
  process.on('uncaughtException', errorHandler)
  process.on('unhandledRejection', errorHandler)

  // 获取 npm 版本更新信息，退出的时候打印
  // now actually fire up npm and run the command.
  // this is how to use npm programmatically:
  const updateNotifier = require('../lib/utils/update-notifier.js')

  npm.load(async er => {
    if (er)
      return errorHandler(er)
    
    // 这里应该是对 npm 版本有一些特殊判断，具体不清楚
    if (npm.config.get('version', 'cli')) {
      console.log(npm.version)
      // exit(0) 应该是没有错误信息
      return errorHandler.exit(0)
    }

    if (npm.config.get('versions', 'cli')) {
      npm.argv = ['version']
      npm.config.set('usage', false, 'cli')
    }

    // 获取提示更新信息
    npm.updateNotification = await updateNotifier(npm)

    // 获取执行命令
    const cmd = npm.argv.shift()
    const impl = npm.commands[cmd]

    if (impl)
      // 如果存在，则执行
      impl(npm.argv, errorHandler)
    else {
      // 未找到命令实现，则提示 help 用法
      npm.config.set('usage', false)
      npm.argv.unshift(cmd)
      npm.commands.help(npm.argv, errorHandler)
    }
  })
}
