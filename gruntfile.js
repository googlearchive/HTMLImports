/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */
module.exports = function(grunt) {
  var readManifest = require('../tools/loader/readManifest.js');

  var HTMLImports = readManifest('build.json');
  var HTMLImportsNative = readManifest('build-native.json');
  grunt.initConfig({
    karma: {
      options: {
        configFile: 'conf/karma.conf.js',
        keepalive: true
      },
      buildbot: {
        reporters: ['crbot'],
        logLevel: 'OFF'
      },
      HTMLImports: {
      }
    },
    uglify: {
      HTMLImports: {
        options: {
          sourceMap: 'HTMLImports.min.js.map',
          banner: grunt.file.read('banner.txt')
        },
        files: {
          'HTMLImports.min.js': HTMLImports
        }
      },
      HTMLImportsNative: {
        options: {
          sourceMap: 'HTMLImports-native.min.js.map',
          banner: grunt.file.read('banner.txt')
        },
        files: {
          'HTMLImports-native.min.js': HTMLImportsNative
        }
      }
    },
    yuidoc: {
      compile: {
        name: '<%= pkg.name %>',
        description: '<%= pkg.description %>',
        version: '<%= pkg.version %>',
        url: '<%= pkg.homepage %>',
        options: {
          exclude: 'third_party',
          paths: '.',
          outdir: 'docs',
          linkNatives: 'true',
          tabtospace: 2,
          themedir: '../docs/doc_themes/simple'
        }
      }
    },
    pkg: grunt.file.readJSON('package.json')
  });

  grunt.loadTasks('../tools/tasks');
  // plugins
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-yuidoc');
  grunt.loadNpmTasks('grunt-karma');

  // tasks
  grunt.registerTask('default', ['uglify']);
  grunt.registerTask('minify', ['uglify']);
  grunt.registerTask('docs', ['yuidoc']);
  grunt.registerTask('test', ['override-chrome-launcher', 'karma:HTMLImports']);
  grunt.registerTask('test-buildbot', ['override-chrome-launcher', 'karma:buildbot']);
};

