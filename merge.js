#!/usr/bin/env node

var fs = require('fs');
var path = require('path');
var child_process = require('child_process');
var copy_file = require('fs-sync').copy;
var guid = require('guid');
var web_file_extends = ['.html', '.htm', '.js', '.ts', '.css', '.less', '.sass'];
var argv = require('optimist')
    .usage('Merge web dirs.\nUsage: $0 SOURCE_DIR DEST_DIR')
    .demand(2)
    .string(['source', 'dest'])
    .check(function(arg){
        if(!fs.lstatSync(arg._[0]).isDirectory()){
            throw new Error('SOURCE_DIR "' + arg._[0] + '" is not a directory');
        }
        if(!fs.lstatSync(arg._[1]).isDirectory()){
            throw new Error('DEST_DIR "' + arg._[1] + '" is not a directory');
        }
        var source = path.resolve(arg._[0]);
        var desc = path.resolve(arg._[1]);
        if(source == desc){
            throw new Error('DEST_DIR and SOURCE_DIR cannot be same directory: ' + arg._[1]);
        }

        return true;
    })
    .argv;

function walk(path, handleFile, floor) {
    if(!floor){
        floor = 0;
    }
    handleFile(path, floor, fs.lstatSync(path).isDirectory());
    floor++;
    var files = fs.readdirSync(path);
    files.forEach(function(item) {
        var tmpPath = path + '/' + item;
        if (fs.lstatSync(tmpPath).isDirectory()) {
            walk(tmpPath, handleFile, floor);
        } else {
            handleFile(tmpPath, floor, false);
        }
    });
}

var source_dir = path.resolve(argv._[0]);
var desc_dir = path.resolve(argv._[1]);

function create_random_file_name(file){
    var extend_name = path.extname(file);
    var base_name = path.basename(file, extend_name);
    var dir_name = path.dirname(file);
    var hash = guid.raw();
    return {
        'origin':{
            base_name: base_name,
            extend_name: extend_name,
            dir_name: dir_name,
            file_name: base_name + extend_name,
            path: file
        },
        'rename':{
            base_name: base_name + '.' + hash,
            extend_name: extend_name,
            dir_name: dir_name,
            file_name: base_name+'.'+hash+extend_name,
            path: path.resolve(dir_name, base_name+'.'+hash+extend_name)
        }
    };
}



function rename_file(o_file, floor){
    var info = create_random_file_name(o_file);
    //child_process.execSync("mv "+ info['origin']['path'] + " " + info['rename']['path']);
    walk(desc_dir, function(file, floor, isDirectory){
        if(floor == 0){
            return true;
        }
        if(isDirectory){
            return true;
        }
        var extend_name = path.extname(file);
        if(web_file_extends.indexOf(extend_name) != -1){
            var source = fs.readFileSync(file, 'utf-8');
            source = source.replace(new RegExp(info['origin']['file_name'], 'g'), info['rename']['file_name']);
            fs.writeFileSync(file, source);
        }
        var to_name = file.replace(new RegExp(info['origin']['file_name'], 'g'), info['rename']['file_name']);
        if(file != to_name){
            child_process.execSync("mv "+ file + " " + to_name);
        }
    });
}

walk(source_dir, function(file, floor, isDirectory){
    if(floor == 0){
        return true;
    }
    var relative_path = path.relative(source_dir, file);
    var desc_path = path.resolve(desc_dir, relative_path);
    if(isDirectory){
        if(!fs.existsSync(desc_path)){
            fs.mkdirSync(desc_path);
            return true;
        }
        if(fs.lstatSync(desc_path).isDirectory()){
            return true;
        }
        rename_file(desc_path, floor);
        return true;
    }else{
        if(!fs.existsSync(desc_path)){
            copy_file(file, desc_path);
            return true;
        }
        if(fs.lstatSync(desc_path).isDirectory()) {
            rename_file(desc_path, floor);
            copy_file(file, desc_path);
            return true;
        }
        rename_file(desc_path, floor);
        copy_file(file, desc_path);
        return true;
    }
});