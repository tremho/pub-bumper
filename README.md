# pub-bumper

Intelligent version bumping for a related suite of modules in development

[![Build Status][build-status]][build-url]
[![NPM version][npm-image]][npm-url]
[![Downloads][downloads-image]][npm-url]
[![TotalDownloads][total-downloads-image]][npm-url]
[![Twitter Follow][twitter-image]][twitter-url]

[build-status]:https://travis-ci.org/tremho/pub-bumper.svg?branch=develop
[build-url]:https://travis-ci.org/tremho/pub-bumper
[npm-image]:http://img.shields.io/npm/v/pub-bumper.svg
[npm-url]:https://npmjs.org/package/pub-bumper
[downloads-image]:http://img.shields.io/npm/dm/pub-bumper.svg
[total-downloads-image]:http://img.shields.io/npm/dt/pub-bumper.svg?label=total%20downloads
[twitter-image]:https://img.shields.io/twitter/follow/Tremho1.svg?style=social&label=Follow%20me
[twitter-url]:https://twitter.com/Tremho1

### Purpose:
When working on multiple dependent modules that all combine to form a single
suite for an application or library, you will need to make interim
revisions and have these in sync between your Git repository and your
published npm packages, both pre-release and release.

`pub-bumper` allows you to define a configuration file with a list
of module project directories, each of which are presumed to be represented
by a git repository, for a given project.

You can then run pub-bumper against this config to update all the modules,
bumping thier pre-release version numbers, and checking into git all in
one step.
The npm modules will be published with the updated versioning.

You may specify a "release" publish, which will do the same thing, but 
will strip the -pre-release component of the version and 
will tag the git commit with 'vX.X.X' (X.X.X being the release version).

So, if you start out with your npm package version as "0.0.0",
then when you run pub-bumper on it it will change to "0.0.1-pre-release.1".

Subsequent runs will bump it to "0.0.1-pre-release.2","0.0.1-pre-release.3",
and so on until you specify "release", at which point it becomes "0.0.1".

Then, the next time you bump it, it will start a new series against the
next release: "0.0.2-pre-release.1"

The pre-release tag defaults to "pre-release", but you can change it
between releases.  This allows you to specify development phase status
such as "alpha", or "beta", or "internal", or "review" (or whatever).

For more information on versioning pre-release tags, please see the [semver specification](https://semver.org).

#### Installing

#### Configuring
If you are going to use `pub-bump` only on your current directory,
you do not need to specify a configuration file.  The default configuration
applies to the current directory.  Run it at your project root.

If you have multiple modules to update at once, and/or you wish to
execute `pub-bump` from a directory other than the current project root,
you will need to create a configuration file and specify it when running pub-bump.

###### configuration file (json)
    {
        "preReleaseTag" :    tag to use if not overridden by command line
                             If not provided, default is "pre-release"

        "projectDirs" : [
                          an array of project directory locations 
                          these strings may be absolute paths or paths
                          relative to the current directory when
                          pub-bump is run.
                        ]
    }

#### Using

type `pub-bump` with no arguments, or with `-h` or `--help` to get
a list of commands and a config format refresher.


###### for a single module project
        pub-bump -m "commit message"
        pub-bump release -m "commit message"
        pub-bump --pre "alpha" -m "commit message"
        pub-bump -m "commit message" --no-publish

###### for a multiple modules, using a config file as explained above 

        pub-bump -m "commit message" -c pathToConfig
        pub-bump release -m "commit message" --config pathToConfig
        pub-bump --pre "alpha" -m "commit message" -c pathToConfig
        pub-bump -m "commit message" --no-publish --config pathToConfig

###
