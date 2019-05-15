# Simplate
A simple html template script


### How to use
Run the `simplate.js` script from your cli with 3 input arguments and 1 optional argument, all separated by a space.
Example:
`node lib/simplate.js ../example/input ../example/output ../example/input/_layout.html`

1. **Input path**. A relative file path to the directory with the html files you wish to process. (html files that start with an "_" underscore will be ignored)
2. **Output path**. A relative file path to the directory where you want to new files to be placed. (Any files in the output directory with the same names will be overwritten)
3. **Layout path**. A relative file path to an html file that with be the starting point for all the new html files. (This file must contain a link token like this: `@link{{"src":"main-content"}}`)
4. **Look in sub-directories (optional)**. Specify "false" if you do not want the script to look inside sub-directories of the input path. The default is value "true" when no 4th argument is given.

Note all paths are relative to the `simplate.js` script in the `lib/` directory.


### HTML tokens/commands
There are only 3 token to remember:
1. **Insert** `@insert{header.html}@` Used to insert other .html files.
2. **Props** `@props{{"title":"My website"}}@` Used to pass in properties so they can be used by the display token or other props tokens. The props must be a valid JSON object.
3. **Display** `@display{title}@` Used to display a property from props. Display tokens can have a default value that will be used if it can not find a property with the correct key. To set a default value the token must be a valid JSON object with two properties is, "key" and "default", so for example `@display{{"key":"title","default":"My website title"}@`


### Processing steps (How the script works)
1. For each html file in the input directory that does not start with an "_", the script will load that file and place it inside the Layout html (this is the html file you specified as the 3rd input argument in the position fo the `@insert{main-content}@`).
2. Resolve all Insert tokens and build one full html document.
3. Find all Props tokens and store their values. (Props can be overwrites by a prop with the same name lower in the html document)
4. Find all Display token and if there is a matching prop, insert it.
5. Write the processed file into the output directory. (If there is a file with the same name it will overwrite it)


### Example html

input/_layout.html
```
<html>
    <head>
    <title>@display{title}@</title>
    </head>
    <body>
        @insert{_header.html}@

        @insert{main-content}@
    </body>
</html>
```

input/index.html
```
@props{{"title":"This is my title"}}@
<h1>This is my index page</h1>
```

input/_header.html
```
<p>Here is my header</p>
```

The output will be:
output/index.html
```
<html>
    <head>
    <title>This is my title</title>
    </head>
    <body>
        <p>Here is my header</p>

        <h1>This is my index page</h1>
    </body>
</html>
```

### Extras
* Props are just JSON objects with key-value pairs, this means they can also have functions in them. If your value starts with "function(" then the script will try insert the return result into the html.