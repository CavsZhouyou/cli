/*
 * @Author: xiaotian@tangping 
 * @Descriptions: 打印 banner 提示用户 npm 更新信息
 * @TodoList: 无
 * @Date: 2021-03-18 20:47:44 
 * @Last Modified by: xiaotian@tangping
 * @Last Modified time: 2021-04-12 21:23:12
 */

// print a banner telling the user to upgrade npm to latest
// but not in CI, and not if we're doing that already.
// Check daily for betas, and weekly otherwise.

const pacote = require('pacote')
const ciDetect = require('@npmcli/ci-detect')
const semver = require('semver')
const chalk = require('chalk')
const { promisify } = require('util')
const stat = promisify(require('fs').stat)
const writeFile = promisify(require('fs').writeFile)
const { resolve } = require('path')

/**
 * 判断是否为全局的 npm 更新
 *
 * @param {*} npm
 * @return {*} 
 */
const isGlobalNpmUpdate = npm => {
  return npm.flatOptions.global &&
    ['install', 'update'].includes(npm.command) &&
    npm.argv.includes('npm')
}

// update check frequency
const DAILY = 1000 * 60 * 60 * 24
const WEEKLY = DAILY * 7

const updateTimeout = async (npm, duration) => {
  // 计算理论上的上一次检查时间
  const t = new Date(Date.now() - duration)
  // don't put it in the _cacache folder, just in npm's cache
  const f = resolve(npm.flatOptions.cache, '../_update-notifier-last-checked')

  // 获取上次的文件修改时间
  // if we don't have a file, then definitely check it.
  const st = await stat(f).catch(() => ({ mtime: t - 1 }))

  // 如果理论上一次的检查时间大于了上一次文件的修改时间，则说明已过期，需要重新检查
  if (t > st.mtime) {
    // best effort, if this fails, it's ok.
    // might be using /dev/null as the cache or something weird like that.
    await writeFile(f, '').catch(() => {})
    return true
  } else
    return false
}

const updateNotifier = module.exports = async (npm, spec = 'latest') => {
  // CI、已经提醒过一次、全局 npm 安装时，不再提醒更新
  // never check for updates in CI, when updating npm already, or opted out
  if (!npm.config.get('update-notifier') ||
      isGlobalNpmUpdate(npm) ||
      ciDetect())
    return null

  // 解析版本信息
  // if we're on a prerelease train, then updates are coming fast
  // check for a new one daily.  otherwise, weekly.
  const { version } = npm
  const current = semver.parse(version)

  // 如果是 beta 版本的情况，则获取下一个大版本
  // if we're on a beta train, always get the next beta
  if (current.prerelease.length)
    spec = `^${version}`

  // 判断获取版本更新的查询周期
  // while on a beta train, get updates daily
  const duration = spec !== 'latest' ? DAILY : WEEKLY

  // 如果在检查周期内，不再检查
  // if we've already checked within the specified duration, don't check again
  if (!(await updateTimeout(npm, duration)))
    return null

  // if they're currently using a prerelease, nudge to the next prerelease
  // otherwise, nudge to latest.
  const useColor = npm.log.useColor()

  // 获取 npm 的 manifest 文件
  const mani = await pacote.manifest(`npm@${spec}`, {
    // always prefer latest, even if doing --tag=whatever on the cmd
    defaultTag: 'latest',
    ...npm.flatOptions,
  }).catch(() => null)

  // 获取失败，则直接返回
  // if pacote failed, give up
  if (!mani)
    return null

  // 最新的 version
  const latest = mani.version

  // 如果当前版本小于最新版本，且版本号不具体
  // if the current version is *greater* than latest, we're on a 'next'
  // and should get the updates from that release train.
  // Note that this isn't another http request over the network, because
  // the packument will be cached by pacote from previous request.
  if (semver.gt(version, latest) && spec === 'latest')
    return updateNotifier(npm, `^${version}`)

  // 如果当前版本满足条件，则不需要更新
  // if we already have something >= the desired spec, then we're done
  if (semver.gte(version, latest))
    return null

  // 返回用户更新消息
  // ok!  notify the user about this update they should get.
  // The message is saved for printing at process exit so it will not get
  // lost in any other messages being printed as part of the command.
  const update = semver.parse(mani.version)
  const type = update.major !== current.major ? 'major'
    : update.minor !== current.minor ? 'minor'
    : update.patch !== current.patch ? 'patch'
    : 'prerelease'
  const typec = !useColor ? type
    : type === 'major' ? chalk.red(type)
    : type === 'minor' ? chalk.yellow(type)
    : chalk.green(type)
  const oldc = !useColor ? current : chalk.red(current)
  const latestc = !useColor ? latest : chalk.green(latest)
  const changelog = `https://github.com/npm/cli/releases/tag/v${latest}`
  const changelogc = !useColor ? `<${changelog}>` : chalk.cyan(changelog)
  const cmd = `npm install -g npm@${latest}`
  const cmdc = !useColor ? `\`${cmd}\`` : chalk.green(cmd)
  const message = `\nNew ${typec} version of npm available! ` +
    `${oldc} -> ${latestc}\n` +
    `Changelog: ${changelogc}\n` +
    `Run ${cmdc} to update!\n`
  const messagec = !useColor ? message : chalk.bgBlack.white(message)

  return messagec
}
