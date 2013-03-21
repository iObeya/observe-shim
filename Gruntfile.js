'use strict';
module.exports = function (grunt) {
    require('matchdep').filterDev('grunt-*').forEach(grunt.loadNpmTasks);

    var sourceFiles = ['src/Observe.js', 'src/ObserveUtils.js'];
    grunt.initConfig({
        jshint: {
            options: {
                jshintrc: '.jshintrc'
            },
            all: [ 'src/*.js' ]
        },
        mocha : {
            index: ['test/index.html'],
            options: {
                run : true
            }
        },
        clean : {
            folder : ['docs','dist']
        },
        concat: {
            dist: {
                src: sourceFiles,
                dest: 'dist/observe-shim.js'
            }
        },
        uglify: {
            dist : {
                files: {
                    'dist/observe-shim.min.js': sourceFiles
                }
            }
        },
        docco: {
            src: ['src/*.js'],
            options: {
                output: 'docs/'
            }
        }
    });

    grunt.registerTask('test', ['jshint', 'mocha']);
    grunt.registerTask('default', ['test','clean','concat','uglify','docco']);
};