# kitsu-downloader

This tool downloads the anime and character data from [Kitsu](https://kitsu.io).
Linked Data can then be generated from this data via the corresponding [rules](https://github.com/betweenourworlds/generation-rules).

## Installation

1. Clone this repo
2. Navigate into the folder: `cd kitsu-downloader`
3. Install Node dependencies: `npm i`
4. Link the bin: `npm link`

## Usage

The tool takes the following arguments

- `-V, --version`: output the version number
- `-e, --entity [entity]`: Choose between "anime" and "character"
- `-s, --start [start]`: Number of start page
- `-t, --stop [stop]`: Number of stop page
- `-o, --output [output]`: Path to output folder (default: "")
- `-v, --verbose`: Make the application more talkative
- `-h, --help`: output usage information

When you execute `kitsu-downloader -e anime -s 0 -t 199 -o test`,
the first 200 pages of anime data will be downloaded and the 200 files will be put in the folder `test`.

## License

2018 Between Our Worlds, [MIT License](https://github.com/betweenourworlds/kitsu-downloader/blob/master/LICENSE.md)