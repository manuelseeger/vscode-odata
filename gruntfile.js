module.exports = function (grunt) {
    grunt.initConfig({
        exec: {
            pegjs: {
                command: "node node_modules/pegjs/bin/pegjs --format umd -o ./src/odataParser.js ./src/odataParser.pegjs"
            }
        },
        copy: {
            pegjs: {
                files: [
                    {
                        src: "./src/odataParser.js",
                        dest: "./out/src/odataParser.js",
                    }
                ]
            }, 
            tests: {
                files: [
                    {
                        expand: true,
                        cwd: './src/test/fixtures/',
                        src: ['**'],
                        dest: './out/src/test/fixtures/',
                    }
                ]
            }
        },
    });

    grunt.loadNpmTasks("grunt-exec");
    grunt.loadNpmTasks("grunt-contrib-copy");

    grunt.registerTask("build", ["exec:pegjs", "copy:pegjs"]);
    grunt.registerTask("pretest", ["copy:tests"]);
    grunt.registerTask("default", ["build"]);
};
