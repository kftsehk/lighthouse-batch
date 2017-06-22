'use strict'
require('shelljs/global');
const fs = require('fs')
const path = require('path')

const OUT = './report/lighthouse'
const REPORT_SUMMARY = 'summary.json'

execute.OUT = OUT
module.exports = execute;

function execute(options) {
  const out = options.out || OUT
  const lhc = lighthouseCmd(options)
  const summaryPath = `${out}/${REPORT_SUMMARY}`

  log = log.bind(log, options.verbose || false)

  rm('-rf', out)
  mkdir('-p', out)

  const count = options.sites.length
  log(`Lighthouse batch run begin for ${count} site${count > 1 ? 's' : ''}`)

  const reports = sitesInfo(options).map((site, i) => {
    console.log(site)
    const filePath = `${out}/${site.file}`
    const prefix = `${i + 1}/${count}: `
    const htmlOut = options.html ? ' --output html' : ''
    const cmd = `${site.url} --output json${htmlOut} --output-path ${filePath} ${options.params}`

    log(`${prefix}Lighthouse analyzing '${site.url}'`)
    log(cmd)

    const outcome = exec(`${lhc} ${cmd}`)
    const summary = updateSummary(filePath, site, outcome, options)

    if (summary.error) console.warn(`${prefix}Lighthouse analysis FAILED for ${summary.url}`)
    else log(`${prefix}Lighthouse analysis of '${summary.url}' complete with score ${summary.score}`)

    return summary
  })

  log(`Lighthouse batch run end`)
  log(`Writing reports summary to ${summaryPath}`)
  fs.writeFileSync(summaryPath, JSON.stringify(reports), 'utf8')
}

function sitesInfo(options) {
  return options.sites.map(url => {
    url = url.trim()
    if (!url.match(/^https?:/)) {
      if (!url.startsWith('//')) url = `//${url}`
      url = `https:${url}`
    }
    const name = siteName(url)
    // if gen'ing html+json reports, report.json is added on automatically,
    // so here we try and keep the named files consistent
    const file = options.html ? name : `${name}.report.json` 
    console.log('file', file, options.html, name)
    return {
      url,
      name,
      file
    }
  })
}

function lighthouseCmd(options) {
  if (options.useGlobal) {
    if (exec('lighthouse --version').code === 0) {
      return 'lighthouse '
    } else {
      console.warn('Global Lighthouse install not found, falling back to local one')
    }
  }
  let cliPath = path.resolve(`${__dirname}/node_modules/lighthouse/lighthouse-cli/index.js`)
  if (!fs.existsSync(cliPath)) {
    cliPath = path.resolve(`${__dirname}/../lighthouse/lighthouse-cli/index.js`)
    if (!fs.existsSync(cliPath)) {
      console.error(`Faild to find Lighthouse CLI, aborting.`)
      process.exit(1)
    }
  }
  return cliPath
}

function siteName(site) {
  return site.replace(/^https?:\/\//, '').replace(/[\/\?#:\*\$@\!\.]/g, '_')
}

function updateSummary(filePath, summary, outcome, options) {
  if (outcome.code !== 0) {
    summary.score = 0
    summary.error = outcome.stderr
    return summary
  }
  const realFilePath = options.html ? `${filePath}.report.json` : filePath
  const report = JSON.parse(fs.readFileSync(realFilePath))
  summary.score = report.score.toFixed(2)
  return summary
}

function log(v, msg) {
  if (v) console.log(msg)
}