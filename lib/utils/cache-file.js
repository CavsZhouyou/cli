/*
 * @Author: xiaotian@tangping 
 * @Descriptions: 缓存文件管理
 * @TodoList: 无
 * @Date: 2021-04-12 20:39:33 
 * @Last Modified by:   xiaotian@tangping 
 * @Last Modified time: 2021-04-12 20:39:33 
 */
const npm = require('../npm.js')
const path = require('path')
const chownr = require('chownr')
const writeFileAtomic = require('write-file-atomic')
const mkdirp = require('mkdirp-infer-owner')
const fs = require('graceful-fs')

let cache = null
let cacheUid = null
let cacheGid = null
let needChown = typeof process.getuid === 'function'

/**
 * 判断 cache file 的操作权限
 */
const getCacheOwner = () => {
  let st
  try {
    // 获取文件的详细信息
    st = fs.lstatSync(cache)
  } catch (er) {
    if (er.code !== 'ENOENT')
      throw er

    // 获取文件目录的详细信息
    st = fs.lstatSync(path.dirname(cache))
  }

  // 获取文件的 uid 和 gid 消息
  cacheUid = st.uid
  cacheGid = st.gid

  // 通过 uid 和 gid 来判断是否有操作权限
  needChown = st.uid !== process.getuid() ||
    st.gid !== process.getgid()
}

const writeOrAppend = (method, file, data) => {

  // cache 判空，获取 config 中的 cache 地址
  if (!cache)
    cache = npm.config.get('cache')

  // 如果 file 为相对路径，则解析判断 cache 里是否含有此文件
  // redundant if already absolute, but prevents non-absolute files
  // from being written as if they're part of the cache.
  file = path.resolve(cache, file)

  // 判断 cache file 的操作权限
  if (cacheUid === null && needChown)
    getCacheOwner()

  // 创建目录，如果已存在，则 firstMade 为 undefined
  const dir = path.dirname(file)
  const firstMade = mkdirp.sync(dir)

  // 如果有权限
  if (!needChown)
    return method(file, data)

  let methodThrew = true
  try {
    // 执行方法
    method(file, data)
    // 设置没有报错的标识
    methodThrew = false
  } finally {
    // always try to leave it in the right ownership state, even on failure
    // let the method error fail it instead of the chownr error, though
    // 如果没有报错，则直接修改权限
    if (!methodThrew)
      chownr.sync(firstMade || file, cacheUid, cacheGid)
    else {
      // 否则加一个 try catch 吃掉错误
      try {
        chownr.sync(firstMade || file, cacheUid, cacheGid)
      } catch (_) {}
    }
  }
}

exports.append = (file, data) => writeOrAppend(fs.appendFileSync, file, data)
exports.write = (file, data) => writeOrAppend(writeFileAtomic.sync, file, data)
