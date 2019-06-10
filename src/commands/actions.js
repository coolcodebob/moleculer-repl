"use strict";

const chalk = require("chalk");
const _ = require("lodash");
const { table, getBorderCharacters } = require("table");
const beautify = require("js-beautify").js;

const {
	match,
	CIRCUIT_CLOSE,
	CIRCUIT_HALF_OPEN,
	CIRCUIT_OPEN
} = require("../utils");

module.exports = function(vorpal, broker) {
	// List actions
	vorpal
		.command("actions", "List of actions")
		.option("-a, --all", "list all (offline) actions")
		.option("-d, --details", "print endpoints")
		.option("-f, --filter <match>", "filter actions (e.g.: 'users.*')")
		.option("-i, --skipinternal", "skip internal actions")
		.option("-l, --local", "only local actions")
		.action((args, done) => {
			const actions = broker.registry.getActionList({
				onlyLocal: args.options.local,
				onlyAvailable: !args.options.all,
				skipInternal: args.options.skipinternal,
				withEndpoints: args.options.details
			});

			const data = [
				[
					chalk.bold("Action"),
					chalk.bold("Params"),
					chalk.bold("Response"),
					chalk.bold("Auth / Permissions")
				]
			];

			let hLines = [];

			actions.sort((a, b) => a.name.localeCompare(b.name));

			let lastServiceName;

			let formatParams = params => {
				if (!params.name) {
					return Object.keys(params).join(", ");
				}
				const preparedParams =
					params.name &&
					params.name.replace(/\{\|/gi, "{").replace(/\|\}/gi, "}");
				return beautify(preparedParams, {
					indent_size: "4",
					indent_char: " ",
					max_preserve_newlines: "1",
					preserve_newlines: true,
					keep_array_indentation: false,
					break_chained_methods: false,
					indent_scripts: "keep",
					brace_style: "end-expand",
					space_before_conditional: false,
					unescape_strings: false,
					jslint_happy: false,
					end_with_newline: false,
					wrap_line_length: "50",
					indent_inner_html: false,
					comma_first: false,
					e4x: false,
					indent_empty_lines: false
				});
			};

			let getPermissions = action => {
				if (action.permissions && action.permissions.length) {
					return chalk.green(`[${action.permissions.join(", ")}]`);
				} else if (action.authRequired) {
					return chalk.green("REQUIRED");
				}
				return chalk.red("NOT REQUIRED");
			};

			actions.forEach(item => {
				const action = item.action;
				const params =
					action && action.params ? formatParams(action.params) : "";

				if (
					args.options.filter &&
					!match(item.name, args.options.filter)
				)
					return;

				const serviceName = item.name.split(".")[0];

				// Draw a separator line
				if (lastServiceName && serviceName != lastServiceName)
					hLines.push(data.length);
				lastServiceName = serviceName;

				if (action) {
					data.push([
						action.name,
						params,
						action.response,
						getPermissions(action)
					]);
				} else {
					data.push([item.name, ""]);
				}

				let getStateLabel = state => {
					switch (state) {
						case true:
						case CIRCUIT_CLOSE:
							return chalk.bgGreen.white("   OK   ");
						case CIRCUIT_HALF_OPEN:
							return chalk.bgYellow.black(" TRYING ");
						case false:
						case CIRCUIT_OPEN:
							return chalk.bgRed.white(" FAILED ");
					}
				};

				if (args.options.details && item.endpoints) {
					item.endpoints.forEach(endpoint => {
						data.push(["", ""]);
					});
					hLines.push(data.length);
				}
			});

			const tableConf = {
				border: _.mapValues(getBorderCharacters("honeywell"), char =>
					chalk.gray(char)
				),
				columns: {
					2: { width: 30, wrapWord: true },
					3: { width: 20, wrapWord: true }
				},
				drawHorizontalLine: (index, count) =>
					index == 0 ||
					index == 1 ||
					index == count ||
					hLines.indexOf(index) !== -1
			};

			console.log(table(data, tableConf));
			done();
		});
};
