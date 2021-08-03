#!/usr/bin/env node

const git = require('git-utils')
const fs = require('fs')
const path = require('path')

import {executeCommand} from './execCmd'

let workingDirectory:string = process.cwd()
let packageData:any
let tabsfound: number
let comment:string = ''
let configPath:string = ''
let config:any = {
    preReleaseTag: 'pre-release',
    projectDirs: [ '.' ]
}

let preReleaseTag = 'pre-release' // todo allow change (i.e. alpha, beta)

/**
 * check the status of the local repo
 * possible outcomes:
 *   'X' - there is no repo
 *   'M' - the repo has modifications that should be checked in
 *   '' -  the repo has no modifications
*/
function checkRepoStatus():string {
   const repo = git.open(workingDirectory)
    if(!repo) return "X"

    function checkMods(dir:string):string {
        let modified = ''
        const entries = fs.readdirSync(dir)
        for(let f of entries) {
            if(f === '.git') continue
            if(!modified) {
                let ref = path.join(dir, f)
                let fp = path.join(workingDirectory, ref)
                if(fs.lstatSync(fp).isDirectory()) {
                    modified = checkMods(ref)
                } else {
                    modified = repo.isPathModified(ref) ? 'M' : ''
                }
            }
            if(modified) break; // one is all we need
        }
        return modified
    }
    return checkMods('.')
}


/**
 * read the current version of this  module
 * keep the parsed package data and remember the tab spacing
 */
function readPackageVersion():string {
    let filepath = path.join(workingDirectory, 'package.json')
    if (!fs.existsSync(filepath)) {
        console.error('No package.json found here!', workingDirectory)
        return ''
    }
    const text = fs.readFileSync(filepath).toString()
    let eol1 = text.indexOf('\n')
    let qn = text.indexOf('"', eol1)
    tabsfound = qn - eol1 - 1
    if (tabsfound < 1) tabsfound = 2;
    packageData = JSON.parse(text)
    return packageData.version
}

// bump the pre-release number of this module
function bumpVersion():string {
    if(!packageData || !packageData.version) {
        console.error('package version unavailable')
        return ''
    }
    let version = packageData.version
    const dn = version.indexOf('-')
    if(dn === -1) {
        // this is not a pre-release version
        let [maj, min, rev] = version.split('.')
        // so bump up the revision and tag it as the first next pre-release
        let nv = `${maj}.${min}.${Number(rev)+1}-${preReleaseTag}.1`
        packageData.version = nv
    } else {
        let nn = version.indexOf('.', dn)
        let tag = version.substring(dn+1, nn)
        if(tag !== preReleaseTag) {
            console.error(`pre-existing version tag ${tag} differs from ${preReleaseTag}. no change made.`)
            console.log('you may only change the pre-release tag following a prior release')
        } else {
            let pn = Number(version.substring(nn+1))
            let nv = version.substring(0, nn+1)+(pn+1)
            packageData.version = nv;
        }

    }
    return packageData.version
}

function setAsRelease() {
    if(!packageData || !packageData.version) {
        console.error('package version unavailable')
        return
    }
    let v = packageData.version
    let n = v.indexOf('-')
    if(n !== -1) v = v.substring(0, n)
    packageData.version = v
}

/**
 * write modified package.json back
 * use same tab spacings found on read
 */
function writeUpdatedPackage() {
    if(!packageData || !packageData.version) {
        console.error('package version unavailable')
        return
    }
    const text = JSON.stringify(packageData, null, tabsfound)
    const filepath = path.join(workingDirectory, 'package.json')
    fs.writeFileSync(filepath, text)
}

/**
 * Commit changes to git using the given commen, and optional tag
 * @param comment
 * @param gitTag
 */
function commitChanges(comment:string, gitTag?:string) {
    let gitcmd = `git commit -am "${comment}"`
    console.log(gitcmd)
    executeCommand(gitcmd, []).then((rt:any) => {
        if(rt.errStr) {
            console.error('Error:\n', rt.errStr)
        } else {
            console.log('executed commit', rt.stdStr)
        }
        if(gitTag) {
            console.log('applying tag ', gitTag)
            executeCommand('git', ['--tag', gitTag]).then((rt:any)=> {
                if(rt.errStr) {
                    console.error('Error:\n', rt.errStr)
                } else {
                    console.log(rt.strStr)
                }
            })
        }
    })
}

/**
 * Read the configuration of project directories
 * and the preferred pre-release tag
 * @param configPath
 */
function readConfiguration(configPath:string) {
    if(!configPath) configPath = '.'
    configPath = path.resolve(configPath)
    if(fs.existsSync(configPath)) {
        const text = fs.readFileSync(configPath).toString()
        config = JSON.parse(text)
        preReleaseTag = config.preReleaseTag || preReleaseTag
    }
}

function displayHelp() {

    console.log('---------------------------')
    console.log('pub-bump [release|bump] [-m|--comment "commit comment"] [-c|--config configPath] [--pre preReleaseTag]')
    console.log()
    console.log(' where:')
    console.log('  release - strips pre-release portion of version and tags the commit in the repository')
    console.log('  bump (default if not given) - bumps the pre-release number up by one and commits with comment')
    console.log(' -m or --comment - following string argument is the commit comment saved to repository')
    console.log(' -c or --config specifies the path to a configuration json file')
    console.log(' --pre - following string argument is the pre-release tag to use, overriding the config or the default ("pre-release")')
    console.log('---------------------------')
    console.log(' configuration file json file:')
    console.log('   {')
    console.log('      "preReleaseTag": -- name to use for this series of pre-release versions (default is "pre-release")')
    console.log('      "projectDirs" : [ ... ] -- an array of relative or absolute directory locations containing the project modules you wish updated in this action')
    console.log('   }')
    console.log('---------------------------')
    console.log('To change a pre-release tag (either via --pre or a change in the config), you must first issue a "release",')
    console.log('or otherwise change the version to be plain (e.g. 1.0.0) without any pre-release tags.')
    console.log('new pre-release numbering will start against the next revision update (e.g "1.0.1-prerelease.1"')
    console.log("============================")

    process.exit(0)
}

/*
CLI args

bump (default) -- bump the pre-release version if we have a modification
release -- strip the pre-release tag and release with plain version number

-m | --comment -- the comment to commit to git on check-in
--pre <tag> -- use this pre-release tag (default is pre-release)

 */
function parseCLI(args:string[]) {
    let i = 0;
    let mode = 'bump'
    if(!args.length) args.push('--help')
    while(i<args.length) {
        let f = args[i]
        f = f.trim()
        if(f === '-m' || f === '--comment') {
            comment = args[++i]
            console.log('comment read as', comment)
        }
        else if(f === '--pre') {
            let tag = args[++i]
            if(tag) preReleaseTag = tag
        }
        else if(f === '-c' || f === '--conf') {
            let conf = args[++i]
            if(conf) configPath = conf
        }
        else if(f === '-h' || f === '--help') {
            displayHelp() // does not return. exits with code 0
        }
        else if(f === 'release') {
            mode = 'release'
        }
        else if(f !== 'bump') {
            console.error(`unrecognized argument: ${f}`)
            mode = 'error'
        }
        i++
    }
    return mode
}

function doProcess(mode:string) {
    console.log('processing '+workingDirectory)
    const status = checkRepoStatus()
    if(status === 'X') {
        console.error('no repository!')
    }
    if(status === 'M') {
        readPackageVersion()
        if(mode === 'release') setAsRelease()
        else bumpVersion()
        writeUpdatedPackage()
        let gitTag = ''
        if(mode === 'release') {
            console.log('RELEASE VERSION')
            gitTag = 'v'+packageData.version
        }
        console.log('version set to ', packageData.version)
        if(!comment) {
            const dt = new Date()
            comment = 'no commit message: '+dt.getFullYear()+'-'+dt.getMonth()+'-'+dt.getDate()
        }
        commitChanges(comment, gitTag)

    } else {
        console.log('nothing to commit')
    }
}

const mode:string = parseCLI(process.argv.slice(2))
if(mode === 'error') process.exit(1)
if(configPath) {
    readConfiguration(configPath)
}
for(let d of config.projectDirs) {
    const dr = path.resolve(d)
    if(!fs.existsSync(dr)) {
        console.error(`Project Directory ${dr} specified in configuration file ${configPath} does not exist`)
        process.exit(2)
    }
    workingDirectory = dr
    doProcess(mode)
}

