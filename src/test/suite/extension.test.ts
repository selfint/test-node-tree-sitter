//@ts-nocheck
import Parser = require("tree-sitter");
import JavaScript = require("tree-sitter-javascript");
import fs = require("fs");
// eslint-disable-next-line @typescript-eslint/naming-convention
const { Query, QueryCursor } = Parser;

import { describe, it, beforeEach, afterEach } from "mocha";
import { assert } from "chai";

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from "vscode";
// import * as myExtension from '../../extension';

suite("Extension Test Suite", () => {
  vscode.window.showInformationMessage("Start all tests.");

  test("Sample test", () => {
    assert.strictEqual(-1, [1, 2, 3].indexOf(5));
    assert.strictEqual(-1, [1, 2, 3].indexOf(0));

    const JAVASCRIPT = require("tree-sitter-javascript");

    const parser = new Parser();
    parser.setLanguage(JAVASCRIPT);
    for (let i = 0; i < 10000; i++) {
      parser.setLanguage(JAVASCRIPT);
      parser.setLogger((msg) => {
        //
      });
    }

    const tree = parser.parse("function main() {}");

    assert.strictEqual(
      tree.rootNode.toString(),
      "(program (function_declaration name: (identifier) parameters: (formal_parameters) body: (statement_block)))"
    );
  });
});
