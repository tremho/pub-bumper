#!/usr/bin/env node

import {exec} from "child_process";

const git = require('git-utils')
const fs = require('fs')
const path = require('path')

import {executeCommand} from './execCmd'
import * as ac from "ansi-colors";

let workingDirectory:string = process.cwd()
let packageData:any
let tabsfound: number
let comment:string = ''
let configPath:string = ''
const defaultConfig:any = {
    preReleaseTag: 'pre-release',
    doPublish: true,
    projectDirs: [ '.' ]
}
let config = defaultConfig

let preReleaseTag = 'pre-release'
let doPublish = true
let noCommit = false


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
        const entries = fs.readdirSync(path.join(workingDirectory, dir))
        for(let f of entries) {
            if(f === '.git') continue
            if(!modified) {
                let ref = path.join(dir, f)
                let fp = path.join(workingDirectory, ref)
                if(fs.existsSync(fp)) {
                    if (fs.lstatSync(fp).isDirectory()) {
                        modified = checkMods(ref)
                    } else {
                        modified = repo.isPathModified(ref) ? 'M' : ''
                    }
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
            noCommit = true
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
function commitChanges(comment:string, gitTag?:string):Promise<unknown> {
    let gitcmd = `git commit -am "${comment}"`
    console.log(ac.green(gitcmd))
    return executeCommand(gitcmd, []).then((rt:any) => {
        if(rt.errStr) {
            console.error(ac.red(rt.errStr))
        } else {
            console.log(ac.grey(rt.stdStr))
        }
        let p = Promise.resolve()
        if(gitTag) {
            console.log('applying tag ', gitTag)
            p =  executeCommand('git', ['tag', gitTag]).then((rt:any)=> {
                if(rt.errStr) {
                    console.error(ac.red(rt.errStr))
                } else {
                    console.log(ac.grey(rt.strStr))
                }
            })
        }
        return p.then(() => {
            console.log('pushing changes')
            return executeCommand('git',['push']).then((rt:any)=> {
                if(rt.errStr) {
                    console.error(ac.red(rt.errStr))
                } else {
                    console.log(ac.grey(rt.strStr))
                }
            })
        })

    })
}

function npmPublish():Promise<unknown> {
    if(doPublish) {
        console.log(ac.italic.green('Publishing to NPM'))
        process.chdir(workingDirectory)
        return executeCommand('npm publish', []).then((rt: any) => {
            if (rt.errStr) {
                // npm normally reports via stdErr
                //
                const lines = rt.errStr.split('\n')
                for (let ln of lines) {
                    ln = ln.trim()
                    if (ln.indexOf("ERR!") !== -1) {
                        if (ln.indexOf("PUT") !== -1) {
                            console.error(ac.red.bold(ln))
                        } else {
                            console.log(ac.grey.italic.dim(ln))
                        }
                    } else if (ln.indexOf("????") !== -1) {
                        console.log(ac.green(ln))
                    }
                }
            } else if (rt.stdStr) {
                console.log(ac.grey(rt.stdStr))
            }
        })
    }
    return Promise.resolve()
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
        workingDirectory = path.dirname(configPath)
        if(fs.lstatSync(configPath).isDirectory()) {
            config = defaultConfig;
        } else {
            const text = fs.readFileSync(configPath).toString()
            config = JSON.parse(text)
        }
        preReleaseTag = config.preReleaseTag || preReleaseTag
    }
}

function displayHelp() {

    console.log(ac.blue(`
         -------------------------------------------
            ${ac.black.bold('pub-bump')} ${ac.grey('[release|bump] [-m|--comment "commit comment"] [-c|--config configPath] [--pre preReleaseTag]')}

             where:
                ${ac.black('release')} - strips pre-release portion of version and tags the commit in the repository
                ${ac.black('bump')} ${ac.dim('default if not given')} - bumps the pre-release number up by one and commits with comment
                ${ac.black('-m')} or ${ac.black('--comment')} - following string argument is the commit comment saved to repository
                ${ac.black('-c')} or ${ac.black('--config')} specifies the path to a configuration json file
                ${ac.black('--pre')} - following string argument is the pre-release tag to use, overriding the config or the default ("pre-release")
                ${ac.black( '--publish')} - force publish to npm even if config says false
                ${ac.black( '--no-publish')} - do not publish to npm
                
         -------------------------------------------
            configuration file json description:
               {
                    ${ac.black('"preReleaseTag"')}: ${ac.dim('-- name to use for this series of pre-release versions (default is "pre-release")')}
                    ${ac.black('"doPublish"')}: ${ac.dim(' -- boolean true or false to publish to npm after commit if not overridden by command line. (default is true)')}
                    ${ac.black('"projectDirs"')} : ${ac.dim('[ ... ] -- an array of relative or absolute directory locations containing the project modules you wish updated in this action')}
               }
         -------------------------------------------
            To change a pre-release tag (either via --pre or a change in the config), you must first issue a "release",')
            or otherwise change the version to be plain (e.g. 1.0.0) without any pre-release tags.')
            new pre-release numbering will start against the next revision update (e.g "1.0.1-prerelease.1"')
         ===========================================
        `))

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
        }
        else if(f === '--pre') {
            let tag = args[++i]
            if(tag) preReleaseTag = tag
        }
        else if(f === '-c' || f === '--config' || f === '-conf') {
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
            console.error(ac.red.bold(`unrecognized argument: ${f}`))
            mode = 'error'
            break;
        }
        i++
    }
    return mode
}

function doProcess(mode:string) {
    let p:Promise<unknown> = Promise.resolve()
    doPublish = config.doPublish
    if(doPublish === undefined) doPublish = true
    noCommit = false
    const status = checkRepoStatus()
    if(status === 'X') {
        console.error(ac.red('no repository!'))
        console.log(ac.grey(workingDirectory))
        process.exit(3)
    }
    if(status === 'M' || mode === 'release') {
        readPackageVersion()
        if(mode === 'release') setAsRelease()
        else bumpVersion()
        writeUpdatedPackage()
        let gitTag = ''
        if(mode === 'release') {
            console.log(ac.green.bold('RELEASE VERSION'))
            gitTag = 'v'+packageData.version
        }
        console.log(ac.italic.magenta('version set to '+ packageData.version))
        if(!comment) {
            const dt = new Date()
            comment = 'no commit message: '+dt.getFullYear()+'-'+dt.getMonth()+'-'+dt.getDate()
        }
        if(!noCommit) {
            process.chdir(workingDirectory)
            p = commitChanges(comment, gitTag).then(() => {
                return npmPublish()
            })
        }
    } else {
        console.log(ac.grey.dim.italic('nothing to commit in '+workingDirectory))
        doPublish = false
    }
    return p
}

const mode:string = parseCLI(process.argv.slice(2))
if(mode === 'error') process.exit(1)

execute(mode, comment,configPath || '.', preReleaseTag)


// API access
/**
 * Executes the `pub-bump` operation
 * @param {string} mode Must be either "release" or "bump" (or "", same as "bump")
 * @param {string} gitComment The git commit comment to apply
 * @param {string|object} configPathOrObject a path to a config file (json), or a config object with {preReleaseTag, projectDirs}
 * @param {string} [pre] optional alternate pre-release tag to use other than configuration or default
 *
 * @return {Promise<unknown>} Promise resolves when execution is complete
  */
export function execute(mode:string, gitComment:string, configPathOrObject:string|object, preTag?:string):Promise<unknown> {
    if(typeof configPathOrObject === 'string') {
        readConfiguration(configPathOrObject)
        workingDirectory = path.dirname(configPathOrObject)
    } else {
        config = configPathOrObject
        workingDirectory = process.cwd()
    }
    comment = gitComment
    if(preTag) preReleaseTag = preTag
    const dirs = (config && config.projectDirs) || [ '.' ]

    const recurse = (i:number = 0):Promise<unknown> => {
        const d = dirs[i]
        if(!d) {
            return Promise.resolve()
        }
        const dr = path.resolve(d)
        if (!fs.existsSync(dr)) {
            console.error(ac.red(`Project Directory ${dr} specified in configuration file ${configPath} does not exist`))
            process.exit(2)
        }
        workingDirectory = dr
        return doProcess(mode).then(() =>{
            return recurse(++i)
        })

    }
    return recurse()

}