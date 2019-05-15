#!/usr/bin/env node

// Simple html template script 
// No dependencies
// Called from cli
// CLI take 3 parameters and 1 optional parameter: 1. input path, 2. output path, 3. layout path (base layout), 4. look in subdirectories. (defaults to "true" is left off)
// Processes all html files in the input directory and creates new files in the output directory, deleting files if there are duplicates
// html files that start with'_' are ignored

(function () {
    "use strict";

    const fs = require('fs');
    const path = require('path');

    // Get user specified paths and store them
    if (process.argv.length < 5 || process.argv.length > 6) { return console.error('Incorrect number of argument given. Please provide the 1. Input path, 2. Output path, 3. Layout path and 4.(optional) look in subdirectories'); }
    const input_path = validate_user_path_arg(process.argv[2]); // The user specified path to the input directory where the script will look for html files.
    const output_path = validate_user_path_arg(process.argv[3]); // The user specified path to the output directory where the script will place the newly created html files.
    const layout_path = validate_user_path_arg(process.argv[4]); // The user specified path to an html file that will be used as the base html file for all other html files.
    const must_walk_directory = validate_user_bool_arg(process.argv[5]); // Optional boolean. If set to "false" the script will not look in subdirectories. The default is "true".

    console.log('\nStarting Simplate...');

    process_files_in_directory(input_path);

    console.log('Build done!')

    /* -------------------------------------- Functions --------------------------------------*/

    function process_files_in_directory(directory_path) {
        let file_list = fs.readdirSync(directory_path); // get list of file names in dir

        file_list.forEach(function (file_name) {
            let file_path = path.join(directory_path, file_name)

            let stat = fs.statSync(file_path);
            if (stat && stat.isDirectory(file_path)) {
                // Is a directory, so go into it and start process its files
                if (must_walk_directory)
                    process_files_in_directory(file_path);
            } else {
                // Is a file so process it
                // Only process .html files that don't start with "_".
                if (!/^_/.test(file_name) && /\.html$/.test(file_name))
                    process_file(file_path, file_name);
            }
        });
    }

    function process_file(file_path, file_name) {
        console.log('Processing file: "' + file_path + '"...');

        // Read data out of the input file and layout file as strings
        let html = read_file_to_string(file_path);
        const layout_data = read_file_to_string(layout_path);

        // Insert the file_data into the layout
        html = layout_data.replace('@insert{main-content}@', html);

        // Process each file
        const final_html = process_html(html, file_name);

        // Write file to output directory
        const final_output_path = file_path.replace(input_path, output_path);
        write_string_to_html(final_output_path, final_html);
    }

    function process_html(html, file_name) {
        // 1. Build full html by resolving all inserts
        html = resolve_insert_tokens(html);

        // 2. Collect all props (will overwrite two props with the same same)
        let stored_data = resolve_props_tokens(html);

        // 3. Do all displays
        html = resolve_display_tokens(stored_data.html, stored_data.props, file_name);

        return html;
    }

    function resolve_insert_tokens(html) {

        let insert_tokens = find_insert_tokens(html);

        insert_tokens.forEach(insert_token => {
            if (!insert_token.hasOwnProperty('src')) return console.error('Each @insert{} must have a "src" property to link to')

            // Get the html to link in
            let file_path = path.join(input_path, insert_token.src);

            if (fs.existsSync(file_path)) {
                let new_html = read_file_to_string(file_path);
                html = insert_html(html, new_html, insert_token.start_index, insert_token.size);
            } else {
                html = insert_html(html, '', insert_token.start_index, insert_token.size);
                return console.error(`Insert to "${insert_token.src}" could not find the file "${file_path}"`);
            }

        });

        // If the html still has links, run again
        if (html.includes('@insert{')) { html = resolve_insert_tokens(html); };

        return html;
    }

    function resolve_props_tokens(html) {
        let found_props_tokens = find_props_tokens(html);
        let stored_props = {};

        found_props_tokens.forEach(token => {

            for (let propertyName in token) {
                if (propertyName != 'type' && propertyName != 'size' && propertyName != 'start_index') {
                    stored_props[propertyName] = token[propertyName];
                }
            }

            // Remove the props token string
            html = insert_html(html, '', token.start_index, token.size);
        });

        return { "props": stored_props, "html": html };
    }

    function resolve_display_tokens(html, props, file_name) {
        let props_tokens = find_display_tokens(html);

        props_tokens.forEach(token => {
            if (!token.key) return console.log(`No "key" set on display token for ${file_name}`);
            let value = '';
            if (props) {
                value = props[token.key];
            }

            if (value) {
                if (value.startsWith("function(")) {
                    console.log(`Function evaluated in ${file_name}`);
                    value = eval('(' + value + ')()');
                    // Note that the scope of this function is available in the eval(). So "props" is there along with everything else.
                }
            } else {
                if (token.default) {
                    value = token.default;
                    console.warn(`Default display used: "${file_name}". Display token "${token.key}" could not find be found but default used.`);
                } else {
                    console.warn(`Warning in file: "${file_name}". Display token "${token.key}" could not find be found.`);
                    value = '';
                }
            }

            html = insert_html(html, value, token.start_index, token.size);
        });
        return html;
    }

    function find_insert_tokens(html) {
        const pattern = new RegExp('@insert{([\\s\\S]*?)}@', 'g');
        const found = [];
        let match = null;
        while ((match = pattern.exec(html)) != null) {
            let found_item = {}
            found_item.src = match[0].replace('@insert{', '').replace('}@', '');
            found_item.type = 'insert';
            found_item.start_index = match.index;
            found_item.size = match[0].length;
            found.push(found_item)
        }
        return found.reverse();
    }

    function find_props_tokens(html) {
        const pattern = new RegExp('@props{{([\\s\\S]*?)}}@', 'g');
        const found = [];

        let match = null;
        while ((match = pattern.exec(html)) != null) {
            const content = match[0].replace('@props{{', '{').replace('}}@', '}').replace(/\r?\n|\r/g, '');
            let found_item = JSON.parse(content);
            found_item.type = 'props';
            found_item.start_index = match.index;
            found_item.size = match[0].length;
            found.push(found_item)
        }
        return found.reverse();
    }

    function find_display_tokens(html) {
        const pattern = new RegExp('@display{([\\s\\S]*?)}@', 'g');
        const found = [];
        let match = null;
        while ((match = pattern.exec(html)) != null) {
            let found_item = {};
            let key = match[0].replace('@display{', '').replace('}@', '');
            if (key.match('^{.*}$')) {
                let json = JSON.parse(key);
                if (!json["key"] && !json["default"]) console.log('If you JSON notation in a display token it must have a "key" and a "default" property');
                found_item.key = json["key"];
                found_item.default = json["default"];
            } else {
                found_item.key = key;
            }
            found_item.type = 'display';
            found_item.start_index = match.index;
            found_item.size = match[0].length;
            found.push(found_item)
        }

        // TODO us defaults. If a json string with "key" and "default" else show warning 

        return found.reverse();
    }

    function insert_html(old_html, new_html, insert_start_position, place_holder_size) {
        return old_html.slice(0, insert_start_position) + new_html + old_html.slice(insert_start_position + place_holder_size, old_html.length);
    }

    /* -------------------------------------- Utility Functions --------------------------------------*/

    function validate_user_path_arg(user_input) {
        if (!user_input) throw `User input: "${user_input}" is null or undefined`;
        if (typeof user_input != "string") throw `User input: "${user_input}" is not a string`;

        const file_path = path.join(__dirname, user_input);
        if (!fs.existsSync(file_path)) throw `Path: "${file_path}" does not exist`;
        return file_path;
    }

    function validate_user_bool_arg(user_input) {
        if (!user_input) return true;
        if (typeof user_input != "string") throw `User input: "${user_input}" is not a string`;
        user_input = user_input.toLocaleLowerCase().trim();
        if (user_input !== "false") throw `Must be either "false" or empty. (If left empty it will default to "true")`;

        if (user_input === "false")
            return false;
        else
            return true;
    }

    function read_file_to_string(file_path) {
        if (!fs.existsSync(file_path)) throw `Path: "${file_path}" does not exist`;
        return fs.readFileSync(file_path, { encoding: 'utf8' });
    }

    function write_string_to_html(file_path, html) {
        console.log(`Writing file:    "${file_path}"...`);
        if (!fs.existsSync(path.dirname(file_path))) {
            fs.mkdirSync(path.dirname(file_path));
        }
        fs.writeFileSync(file_path, html, { encoding: 'utf8' });
    }
}());