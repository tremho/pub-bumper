
const git = require('git-utils')
const fs = require('fs')
const path = require('path')

let workingDirectory:string = process.cwd()
let packageData:any
let tabsfound: number

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
    if(repo.isPathModified(workingDirectory)) {
        return 'M'
    }
    return ''
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
    tabsfound = qn - eol1
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
        let nv = `%${maj}.${min}.${rev+1}-${preReleaseTag}.1`
        packageData.version = nv
    } else {
        let nn = version.indexOf('.', dn)
        let tag = version.substring(dn+1, nn)
        if(tag !== preReleaseTag) {
            console.error(`pre-existing version tag ${tag} differs from ${preReleaseTag}`)
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

/*
CLI args

comment -- the comment to commit to git on check-in
bump (default) -- bump the pre-release version if we have a modification
release -- strip the pre-release tag and release with plain version number

--tag <tag> -- use this pre-release tag (default is pre-release)

 */
function parseCLI(args:string[]) {
    let i = 0;
    let mode = 'bump'
    while(i<args.length) {
        let f = args[i]
        f = f.trim()
        if(f === '--tag') {
            let tag = args[++i]
            if(tag) preReleaseTag = tag
        }
        else if(f === 'release') {
            mode = 'release'
        }
        else if(f !== 'bump') {
            console.error(`unrecognized argument: ${f}`)
            mode = 'error'
        }
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
    } else {
        console.log('nothing to commit')
    }
}

const mode:string = parseCLI(process.argv.slice(2))
doProcess(mode)