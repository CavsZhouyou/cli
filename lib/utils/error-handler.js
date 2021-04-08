/*
 * @Author: xiaotian@tangping 
 * @Descriptions: 错误处理
 * @TodoList: 无
 * @Date: 2021-04-08 21:34:56 
 * @Last Modified by: xiaotian@tangping
 * @Last Modified time: 2021-04-08 21:35:54
 */

// 判断是否捕捉过错误
let cbCalled = false
const log = require('npmlog')
const npm = require('../npm.js')
// 判断是否为异常退出
let itWorked = false
const path = require('path')
// 判断是否写入过 log 日志
let wroteLogFile = false
let exitCode = 0
const errorMessage = require('./error-message.js')
const replaceInfo = require('./replace-info.js')

const cacheFile = require('./cache-file.js')

/**
 * 获取 log 文件路径
 */
let logFileName
const getLogFile = () => {
  if (!logFileName)
    logFileName = path.resolve(npm.config.get('cache'), '_logs', (new Date()).toISOString().replace(/[.:]/g, '_') + '-debug.log')

  return logFileName
}

/**
 * 监听 timing 事件，并更新 timings 值
 */
const timings = {
  version: npm.version,
  command: process.argv.slice(2),
  logfile: null,
}
process.on('timing', (name, value) => {
  if (timings[name])
    timings[name] += value
  else
    timings[name] = value
})

/*
 * exit 事件监听
 */
process.on('exit', code => {

  // 触发 npm timeEnd 事件
  process.emit('timeEnd', 'npm')
  // 取消进度条的展示
  log.disableProgress()
  // 更新 timing 
  if (npm.config && npm.config.loaded && npm.config.get('timing')) {
    try {
      timings.logfile = getLogFile()
      // TODO: cacheFile 
      cacheFile.append('_timing.json', JSON.stringify(timings) + '\n')
    } catch (_) {
      // ignore
    }
  }

  // 如果存在 code，说明是异常退出
  if (code)
    itWorked = false
  
  if (itWorked)
    // 如果正常退出，则打印 ok
    log.info('ok')
  else {
    // !cbCalled 代表没有出现过 uncaughtException 和 unhandledRejection 事件，说明这个异常没有被处理到
    if (!cbCalled) {
      log.error('', 'cb() never called!')
      console.error('')
      log.error('', 'This is an error with npm itself. Please report this error at:')
      log.error('', '    <https://github.com/npm/cli/issues>')
      // 写入日志
      writeLogFile()
    }

    if (code)
      log.verbose('code', code)
  }

  // 写入 LogFile
  if (npm.config && npm.config.loaded && npm.config.get('timing') && !wroteLogFile)
    writeLogFile()
  
  // 如果已经生成过了 log，则直接提示用户
  if (wroteLogFile) {
    // just a line break
    if (log.levels[log.level] <= log.levels.error)
      console.error('')

    log.error(
      '',
      [
        'A complete log of this run can be found in:',
        '    ' + getLogFile(),
      ].join('\n')
    )

    // 退出前重置变量？
    wroteLogFile = false
  }

  // 真正的退出
  // actually exit.
  if (exitCode === 0 && !itWorked)
    exitCode = 1

  if (exitCode !== 0)
    process.exit(exitCode)
})

/**
 * 退出处理，主要判断，是否需要生成 log 文件
 */
const exit = (code, noLog) => {
  // exitCode 优先级判断
  exitCode = exitCode || process.exitCode || code

  // 记录 exitCode
  log.verbose('exit', code)

  // 静默模式
  if (log.level === 'silent')
    noLog = true

  // 退出进程
  const reallyExit = () => {
    itWorked = !code

    // Exit directly -- nothing in the CLI should still be running in the
    // background at this point, and this makes sure anything left dangling
    // for whatever reason gets thrown away, instead of leaving the CLI open
    //
    // Commands that expect long-running actions should just delay `cb()`
    process.stdout.write('', () => {
      process.exit(code)
    })
  }

  // 非静默模式下，输出错误信息到 log file 中
  if (code && !noLog)
    writeLogFile()
  reallyExit()
}

/**
 * 根据 er 来进行不同的错误处理
 *
 * @param {*} er
 * @return {*} 
 */
const errorHandler = (er) => {

  // 取消进度条的展示
  log.disableProgress()

  // 在 config 配置前出现错误退出，使用 console 来打印 error
  if (!npm.config || !npm.config.loaded) {
    // logging won't work unless we pretend that it's ready
    er = er || new Error('Exit prior to config file resolving.')
    console.error(er.stack || er.message)
  }

  // 多次调用时，打印错误
  if (cbCalled)
    er = er || new Error('Callback called more than once.')

  // 同时提醒用户更新
  if (npm.updateNotification) {
    const { level } = log
    log.level = log.levels.notice
    log.notice('', npm.updateNotification)
    log.level = level
  }

  cbCalled = true

  // 没有 err 信息，直接退出
  if (!er)
    return exit(0)

  // 判断不符合规范的错误类型，输出不同格式的日志
  // if we got a command that just shells out to something else, then it
  // will presumably print its own errors and exit with a proper status
  // code if there's a problem.  If we got an error with a code=0, then...
  // something else went wrong along the way, so maybe an npm problem?
  const isShellout = npm.shelloutCommands.includes(npm.command)
  const quietShellout = isShellout && typeof er.code === 'number' && er.code
  if (quietShellout)
    return exit(er.code, true)
  else if (typeof er === 'string') {
    log.error('', er)
    return exit(1, true)
  } else if (!(er instanceof Error)) {
    log.error('weird error', er)
    return exit(1, true)
  }

  // 获取 err code
  if (!er.code) {
    const matchErrorCode = er.message.match(/^(?:Error: )?(E[A-Z]+)/)
    er.code = matchErrorCode && matchErrorCode[1]
  }

  // 记录错误的详细信息
  for (const k of ['type', 'stack', 'statusCode', 'pkgid']) {
    const v = er[k]
    if (v)
      log.verbose(k, replaceInfo(v))
  }

  // 记录当前的执行路径
  log.verbose('cwd', process.cwd())

  const os = require('os')

  // auth 信息隐藏
  const args = replaceInfo(process.argv)

  // 记录操作系统信息
  log.verbose('', os.type() + ' ' + os.release())

  // 记录命令参数
  log.verbose('argv', args.map(JSON.stringify).join(' '))

  // 记录版本信息
  log.verbose('node', process.version)
  log.verbose('npm ', 'v' + npm.version)

  // 输出基础对应的错误信息
  for (const k of ['code', 'syscall', 'file', 'path', 'dest', 'errno']) {
    const v = er[k]
    if (v)
      log.error(k, v)
  }

  // 打印错误的详细信息和解决方法
  const msg = errorMessage(er)
  for (const errline of [...msg.summary, ...msg.detail])
    log.error(...errline)

  // 输出 json 格式的错误信息
  if (npm.config && npm.config.get('json')) {
    const error = {
      error: { 
        code: er.code,
        summary: messageText(msg.summary),
        detail: messageText(msg.detail),
      },
    }
    console.error(JSON.stringify(error, null, 2))
  }

  // 判断出码后，退出进程
  exit(typeof er.errno === 'number' ? er.errno : typeof er.code === 'number' ? er.code : 1)
}

// 将 msg 以行的格式输出
const messageText = msg => msg.map(line => line.slice(1).join(' ')).join('\n')

/**
 * 写入 log file
 */
const writeLogFile = () => {
  // 如果已经写了 log 文件，则直接退出
  if (wroteLogFile)
    return

  const os = require('os')

  try {
    // 将 log 记录的内容处理为文件格式
    let logOutput = ''
    log.record.forEach(m => {
      const p = [m.id, m.level]
      if (m.prefix)
        p.push(m.prefix)
      const pref = p.join(' ')

      m.message.trim().split(/\r?\n/)
        .map(line => (pref + ' ' + line).trim())
        .forEach(line => {
          logOutput += line + os.EOL
        })
    })
    // 写入文件
    cacheFile.write(getLogFile(), logOutput)

    // 清除 log 内容，避免二次生成
    // truncate once it's been written.
    log.record.length = 0
    wroteLogFile = true
  } catch (ex) {

  }
}

module.exports = errorHandler
module.exports.exit = exit
