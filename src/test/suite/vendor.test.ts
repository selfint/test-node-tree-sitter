// @ts-nocheck
const Parser = require("tree-sitter");
const JavaScript = require("tree-sitter-javascript");
const { assert } = require("chai");
const fs = require("fs");
const { Query, QueryCursor } = Parser;
import { time } from "console";
// const { TextBuffer } = require("superstring");

import { describe, it, beforeEach, afterEach } from "mocha";

describe("Node", () => {
  const parser = new Parser().setLanguage(JavaScript);

  describe("subclasses", () => {
    it("generates a subclass for each node type", () => {
      const tree = parser.parse(`
        class A {
          @autobind
          @something
          b(c, d) {
            return c + d;
          }
        }
      `);

      const classNode = tree.rootNode.firstChild;
      assert.deepEqual(classNode.fields, [
        "bodyNode",
        "decoratorNodes",
        "nameNode",
      ]);

      const methodNode = classNode.bodyNode.firstNamedChild;
      assert.equal(methodNode.constructor.name, "MethodDefinitionNode");
      assert.equal(methodNode.nameNode.text, "b");
      assert.deepEqual(methodNode.fields, [
        "bodyNode",
        "decoratorNodes",
        "nameNode",
        "parametersNode",
      ]);

      const decoratorNodes = methodNode.decoratorNodes;
      assert.deepEqual(
        decoratorNodes.map((_: { text: any }) => _.text),
        ["@autobind", "@something"]
      );

      const paramsNode = methodNode.parametersNode;
      assert.equal(paramsNode.constructor.name, "FormalParametersNode");
      assert.equal(paramsNode.namedChildren.length, 2);

      const bodyNode = methodNode.bodyNode;
      assert.equal(bodyNode.constructor.name, "StatementBlockNode");

      const returnNode = bodyNode.namedChildren[0];
      assert.equal(returnNode.constructor.name, "ReturnStatementNode");

      const binaryNode = returnNode.firstNamedChild;
      assert.equal(binaryNode.constructor.name, "BinaryExpressionNode");

      assert.equal(binaryNode.leftNode.text, "c");
      assert.equal(binaryNode.rightNode.text, "d");
      assert.equal(binaryNode.operatorNode.type, "+");
    });
  });

  describe(".children", () => {
    it("returns an array of child nodes", () => {
      const tree = parser.parse("x10 + 1000");
      assert.equal(1, tree.rootNode.children.length);
      const sumNode = tree.rootNode.firstChild.firstChild;
      assert.deepEqual(
        sumNode.children.map((child: { type: any }) => child.type),
        ["identifier", "+", "number"]
      );
    });
  });

  describe(".namedChildren", () => {
    it("returns an array of named child nodes", () => {
      const tree = parser.parse("x10 + 1000");
      const sumNode = tree.rootNode.firstChild.firstChild;
      assert.equal(1, tree.rootNode.namedChildren.length);
      assert.deepEqual(
        ["identifier", "number"],
        sumNode.namedChildren.map((child: { type: any }) => child.type)
      );
    });
  });

  describe(".startIndex and .endIndex", () => {
    it("returns the character index where the node starts/ends in the text", () => {
      const tree = parser.parse("a👍👎1 / b👎c👎");
      const quotientNode = tree.rootNode.firstChild.firstChild;

      assert.equal(0, quotientNode.startIndex);
      assert.equal(15, quotientNode.endIndex);
      assert.deepEqual(
        [0, 7, 9],
        quotientNode.children.map(
          (child: { startIndex: any }) => child.startIndex
        )
      );
      assert.deepEqual(
        [6, 8, 15],
        quotientNode.children.map((child: { endIndex: any }) => child.endIndex)
      );
    });
  });

  describe(".startPosition and .endPosition", () => {
    it("returns the row and column where the node starts/ends in the text", () => {
      const tree = parser.parse("x10 + 1000");
      const sumNode = tree.rootNode.firstChild.firstChild;
      assert.equal("binary_expression", sumNode.type);

      assert.deepEqual({ row: 0, column: 0 }, sumNode.startPosition);
      assert.deepEqual({ row: 0, column: 10 }, sumNode.endPosition);
      assert.deepEqual(
        [
          { row: 0, column: 0 },
          { row: 0, column: 4 },
          { row: 0, column: 6 },
        ],
        sumNode.children.map(
          (child: { startPosition: any }) => child.startPosition
        )
      );
      assert.deepEqual(
        [
          { row: 0, column: 3 },
          { row: 0, column: 5 },
          { row: 0, column: 10 },
        ],
        sumNode.children.map((child: { endPosition: any }) => child.endPosition)
      );
    });

    it("handles characters that occupy two UTF16 code units", () => {
      const tree = parser.parse("a👍👎1 /\n b👎c👎");
      const sumNode = tree.rootNode.firstChild.firstChild;
      assert.deepEqual(
        [
          [
            { row: 0, column: 0 },
            { row: 0, column: 6 },
          ],
          [
            { row: 0, column: 7 },
            { row: 0, column: 8 },
          ],
          [
            { row: 1, column: 1 },
            { row: 1, column: 7 },
          ],
        ],
        sumNode.children.map(
          (child: { startPosition: any; endPosition: any }) => [
            child.startPosition,
            child.endPosition,
          ]
        )
      );
    });
  });

  describe(".parent", () => {
    it("returns the node's parent", () => {
      const tree = parser.parse("x10 + 1000");
      const sumNode = tree.rootNode.firstChild;
      const variableNode = sumNode.firstChild;
      assert.equal(sumNode, variableNode.parent);
      assert.equal(tree.rootNode, sumNode.parent);
    });
  });

  describe(".child(), .firstChild, .lastChild", () => {
    it("returns null when the node has no children", () => {
      const tree = parser.parse("x10 + 1000");
      const sumNode = tree.rootNode.firstChild.firstChild;
      const variableNode = sumNode.firstChild;
      assert.equal(variableNode.firstChild, null);
      assert.equal(variableNode.lastChild, null);
      assert.equal(variableNode.firstNamedChild, null);
      assert.equal(variableNode.lastNamedChild, null);
      assert.equal(variableNode.child(1), null);
    });
  });

  describe(".nextSibling and .previousSibling", () => {
    it("returns the node's next and previous sibling", () => {
      const tree = parser.parse("x10 + 1000");
      const sumNode = tree.rootNode.firstChild.firstChild;
      assert.equal(sumNode.children[1], sumNode.children[0].nextSibling);
      assert.equal(sumNode.children[2], sumNode.children[1].nextSibling);
      assert.equal(sumNode.children[0], sumNode.children[1].previousSibling);
      assert.equal(sumNode.children[1], sumNode.children[2].previousSibling);
    });
  });

  describe(".nextNamedSibling and .previousNamedSibling", () => {
    it("returns the node's next and previous named sibling", () => {
      const tree = parser.parse("x10 + 1000");
      const sumNode = tree.rootNode.firstChild.firstChild;
      assert.equal(
        sumNode.namedChildren[1],
        sumNode.namedChildren[0].nextNamedSibling
      );
      assert.equal(
        sumNode.namedChildren[0],
        sumNode.namedChildren[1].previousNamedSibling
      );
    });
  });

  describe(".descendantForIndex(min, max)", () => {
    it("returns the smallest node that spans the given range", () => {
      const tree = parser.parse("x10 + 1000");
      const sumNode = tree.rootNode.firstChild.firstChild;
      assert.equal("identifier", sumNode.descendantForIndex(1, 2).type);
      assert.equal("+", sumNode.descendantForIndex(4, 4).type);

      assert.throws(() => {
        sumNode.descendantForIndex(1, {});
      }, /Character index must be a number/);

      assert.throws(() => {
        sumNode.descendantForIndex();
      }, /Character index must be a number/);
    });
  });

  describe(".namedDescendantForIndex", () => {
    it("returns the smallest node that spans the given range", () => {
      const tree = parser.parse("x10 + 1000");
      const sumNode = tree.rootNode.firstChild;
      assert.equal("identifier", sumNode.descendantForIndex(1, 2).type);
      assert.equal("+", sumNode.descendantForIndex(4, 4).type);
    });
  });

  describe(".descendantForPosition(min, max)", () => {
    it("returns the smallest node that spans the given range", () => {
      const tree = parser.parse("x10 + 1000");
      const sumNode = tree.rootNode.firstChild.firstChild;

      assert.equal(
        "identifier",
        sumNode.descendantForPosition(
          { row: 0, column: 1 },
          { row: 0, column: 2 }
        ).type
      );

      assert.equal(
        "+",
        sumNode.descendantForPosition({ row: 0, column: 4 }).type
      );

      assert.throws(() => {
        sumNode.descendantForPosition(1, {});
      }, /Point must be a {row, column} object/);

      assert.throws(() => {
        sumNode.descendantForPosition();
      }, /Point must be a {row, column} object/);
    });
  });

  describe(".namedDescendantForPosition(min, max)", () => {
    it("returns the smallest named node that spans the given range", () => {
      const tree = parser.parse("x10 + 1000");
      const sumNode = tree.rootNode.firstChild;

      assert.equal(
        sumNode.namedDescendantForPosition(
          { row: 0, column: 1 },
          { row: 0, column: 2 }
        ).type,
        "identifier"
      );

      assert.equal(
        sumNode.namedDescendantForPosition({ row: 0, column: 4 }).type,
        "binary_expression"
      );
    });
  });

  describe(".descendantsOfType(type, min, max)", () => {
    it("finds all of the descendants of the given type in the given range", () => {
      const tree = parser.parse("a + 1 * b * 2 + c + 3");
      const outerSum = tree.rootNode.firstChild.firstChild;
      let descendants = outerSum.descendantsOfType(
        "number",
        { row: 0, column: 2 },
        { row: 0, column: 15 }
      );
      assert.deepEqual(
        descendants.map((node: { startIndex: any }) => node.startIndex),
        [4, 12]
      );

      descendants = outerSum.descendantsOfType(
        "identifier",
        { row: 0, column: 2 },
        { row: 0, column: 15 }
      );
      assert.deepEqual(
        descendants.map((node: { startIndex: any }) => node.startIndex),
        [8]
      );

      descendants = outerSum.descendantsOfType(
        "identifier",
        { row: 0, column: 0 },
        { row: 0, column: 30 }
      );
      assert.deepEqual(
        descendants.map((node: { startIndex: any }) => node.startIndex),
        [0, 8, 16]
      );

      descendants = outerSum.descendantsOfType(
        "number",
        { row: 0, column: 0 },
        { row: 0, column: 30 }
      );
      assert.deepEqual(
        descendants.map((node: { startIndex: any }) => node.startIndex),
        [4, 12, 20]
      );

      descendants = outerSum.descendantsOfType(
        ["identifier", "number"],
        { row: 0, column: 0 },
        { row: 0, column: 30 }
      );
      assert.deepEqual(
        descendants.map((node: { startIndex: any }) => node.startIndex),
        [0, 4, 8, 12, 16, 20]
      );

      descendants = outerSum.descendantsOfType("number");
      assert.deepEqual(
        descendants.map((node: { startIndex: any }) => node.startIndex),
        [4, 12, 20]
      );

      descendants = outerSum.firstChild.descendantsOfType(
        "number",
        { row: 0, column: 0 },
        { row: 0, column: 30 }
      );
      assert.deepEqual(
        descendants.map((node: { startIndex: any }) => node.startIndex),
        [4, 12]
      );
    });
  });

  describe(".closest(type)", () => {
    it("returns the closest ancestor of the given type", () => {
      const tree = parser.parse("a(b + -d.e)");
      const property = tree.rootNode.descendantForIndex("a(b + -d.".length);
      assert.equal(property.type, "property_identifier");

      const unary = property.closest("unary_expression");
      assert.equal(unary.type, "unary_expression");
      assert.equal(unary.startIndex, "a(b + ".length);
      assert.equal(unary.endIndex, "a(b + -d.e".length);

      const sum = property.closest(["binary_expression", "call_expression"]);
      assert.equal(sum.type, "binary_expression");
      assert.equal(sum.startIndex, 2);
      assert.equal(sum.endIndex, "a(b + -d.e".length);
    });

    it("throws an exception when an invalid argument is given", () => {
      const tree = parser.parse("a + 1 * b * 2 + c + 3");
      const number = tree.rootNode.descendantForIndex(4);

      assert.throws(
        () => number.closest({ a: 1 }),
        /Argument must be a string or array of strings/
      );
    });
  });

  describe(".firstChildForIndex(index)", () => {
    it("returns the first child that extends beyond the given index", () => {
      const tree = parser.parse("x10 + 1000");
      const sumNode = tree.rootNode.firstChild.firstChild;

      assert.equal("identifier", sumNode.firstChildForIndex(0).type);
      assert.equal("identifier", sumNode.firstChildForIndex(1).type);
      assert.equal("+", sumNode.firstChildForIndex(3).type);
      assert.equal("number", sumNode.firstChildForIndex(5).type);
    });
  });

  describe(".firstNamedChildForIndex(index)", () => {
    it("returns the first child that extends beyond the given index", () => {
      const tree = parser.parse("x10 + 1000");
      const sumNode = tree.rootNode.firstChild.firstChild;

      assert.equal("identifier", sumNode.firstNamedChildForIndex(0).type);
      assert.equal("identifier", sumNode.firstNamedChildForIndex(1).type);
      assert.equal("number", sumNode.firstNamedChildForIndex(3).type);
    });
  });

  describe(".hasError()", () => {
    it("returns true if the node contains an error", () => {
      const tree = parser.parse("1 + 2 * * 3");
      const node = tree.rootNode;
      assert.equal(
        node.toString(),
        "(program (expression_statement (binary_expression left: (number) right: (binary_expression left: (number) (ERROR) right: (number)))))"
      );

      const sum = node.firstChild.firstChild;
      assert(sum.hasError());
      assert(!sum.children[0].hasError());
      assert(!sum.children[1].hasError());
      assert(sum.children[2].hasError());
    });
  });

  describe(".isMissing()", () => {
    it("returns true if the node is missing from the source and was inserted via error recovery", () => {
      const tree = parser.parse("(2 ||)");
      const node = tree.rootNode;
      assert.equal(
        node.toString(),
        "(program (expression_statement (parenthesized_expression (binary_expression left: (number) right: (MISSING identifier)))))"
      );

      const sum = node.firstChild.firstChild.firstNamedChild;
      assert.equal(sum.type, "binary_expression");
      assert(sum.hasError());
      assert(!sum.children[0].isMissing());
      assert(!sum.children[1].isMissing());
      assert(sum.children[2].isMissing());
    });
  });

  describe(".text", () => {
    Object.entries({
      ".parse(String)": (parser: { parse: (arg0: any) => any }, src: any) =>
        parser.parse(src),
      ".parse(Function)": (
        parser: { parse: (arg0: (offset: any) => any) => any },
        src: string
      ) => parser.parse((offset: any) => src.substr(offset, 4)),
      // '.parseTextBuffer': (parser, src) =>
      //   parser.parseTextBuffer(new TextBuffer(src)),
      // '.parseTextBufferSync': (parser, src) =>
      //   parser.parseTextBufferSync(new TextBuffer(src))
    }).forEach(([method, parse]) =>
      it(`returns the text of a node generated by ${method}`, async () => {
        const src = "α0 / b👎c👎";
        const [numeratorSrc, denominatorSrc] = src.split(/\s*\/\s+/);
        const tree = await parse(parser, src);
        const quotientNode = tree.rootNode.firstChild.firstChild;
        const [numerator, slash, denominator] = quotientNode.children;

        assert.equal(src, tree.rootNode.text, "root node text");
        assert.equal(denominatorSrc, denominator.text, "denominator text");
        assert.equal(src, quotientNode.text, "quotient text");
        assert.equal(numeratorSrc, numerator.text, "numerator text");
        assert.equal("/", slash.text, '"/" text');
      })
    );
  });
});
// const { TextBuffer } = require("superstring");

describe("Parser", () => {
  let parser: {
    setLanguage: (arg0: {} | undefined) => void;
    setLogger: (arg0: string | boolean) => void;
    parse: (
      arg0: string | number | null,
      arg1: null | undefined,
      arg2:
        | {
            includedRanges: {
              startIndex: number;
              endIndex: number;
              startPosition: { row: number; column: number };
              endPosition: { row: number; column: number };
            }[];
          }
        | undefined
    ) => void;
    getLogger: () => any;
  };

  beforeEach(() => {
    parser = new Parser();
  });

  describe(".setLanguage", () => {
    it("throws an exception when the supplied object is not a tree-sitter language", () => {
      assert.throws(() => parser.setLanguage({}), /Invalid language/);
      assert.throws(() => parser.setLanguage(undefined), /Invalid language/);
    });
  });

  describe(".setLogger", () => {
    let debugMessages: any[];

    beforeEach(() => {
      debugMessages = [];
      parser.setLanguage(JavaScript);
      parser.setLogger((message: any) => debugMessages.push(message));
    });

    it("calls the given callback for each parse event", () => {
      parser.parse("a + b + c");
      assert.includeMembers(debugMessages, ["reduce", "accept", "shift"]);
    });

    it("allows the callback to be retrieved later", () => {
      let callback = () => null;

      parser.setLogger(callback);
      assert.equal(callback, parser.getLogger());

      parser.setLogger(false);
      assert.equal(null, parser.getLogger());
    });

    describe("when given a falsy value", () => {
      beforeEach(() => {
        parser.setLogger(false);
      });

      it("disables debugging", () => {
        parser.parse("a + b * c");
        assert.equal(0, debugMessages.length);
      });
    });

    describe("when given a truthy value that isn't a function", () => {
      it("raises an exception", () => {
        assert.throws(
          () => parser.setLogger("5"),
          /Logger callback must .* function .* falsy/
        );
      });
    });

    describe("when the given callback throws an exception", () => {
      let errorMessages: any[],
        originalConsoleError: {
          (message?: any, ...optionalParams: any[]): void;
          (message?: any, ...optionalParams: any[]): void;
        },
        thrownError: Error;

      beforeEach(() => {
        errorMessages = [];
        thrownError = new Error("dang.");

        originalConsoleError = console.error;
        console.error = (message, error) => {
          errorMessages.push([message, error]);
        };

        parser.setLogger((msg: any, params: any) => {
          throw thrownError;
        });
      });

      afterEach(() => {
        console.error = originalConsoleError;
      });

      it.skip("logs the error to the console", () => {
        parser.parse("function() {}");

        assert.deepEqual(errorMessages[0], [
          "Error in debug callback:",
          thrownError,
        ]);
      });
    });
  });

  describe(".parse", () => {
    beforeEach(() => {
      parser.setLanguage(JavaScript);
    });

    it("reads from the given input", () => {
      const parts = ["first", "_", "second", "_", "third"];
      const tree = parser.parse((index: any) => parts.shift());
      assert.equal(
        tree.rootNode.toString(),
        "(program (expression_statement (identifier)))"
      );
    });

    describe("when the input callback returns something other than a string", () => {
      it("stops reading", () => {
        const parts = ["abc", "def", "ghi", {}, {}, {}, "second-word", " "];
        const tree = parser.parse(() => parts.shift());
        assert.equal(
          tree.rootNode.toString(),
          "(program (expression_statement (identifier)))"
        );
        assert.equal(tree.rootNode.endIndex, 9);
        assert.equal(parts.length, 2);
      });
    });

    describe("when the given input is not a function", () => {
      it("throws an exception", () => {
        assert.throws(() => parser.parse(null), /Input.*function/);
        assert.throws(() => parser.parse(5), /Input.*function/);
        assert.throws(() => parser.parse({}), /Input.*function/);
      });
    });

    it("handles long input strings", () => {
      const repeatCount = 10000;
      const inputString = "[" + "0,".repeat(repeatCount) + "]";

      const tree = parser.parse(inputString);
      assert.equal(tree.rootNode.type, "program");
      assert.equal(
        tree.rootNode.firstChild.firstChild.namedChildCount,
        repeatCount
      );
    });

    describe("when the `includedRanges` option is given", () => {
      it("parses the text within those ranges of the string", () => {
        const sourceCode = "<% foo() %> <% bar %>";

        const start1 = sourceCode.indexOf("foo");
        const end1 = start1 + 5;
        const start2 = sourceCode.indexOf("bar");
        const end2 = start2 + 3;

        const tree = parser.parse(sourceCode, null, {
          includedRanges: [
            {
              startIndex: start1,
              endIndex: end1,
              startPosition: { row: 0, column: start1 },
              endPosition: { row: 0, column: end1 },
            },
            {
              startIndex: start2,
              endIndex: end2,
              startPosition: { row: 0, column: start2 },
              endPosition: { row: 0, column: end2 },
            },
          ],
        });

        assert.equal(
          tree.rootNode.toString(),
          "(program (expression_statement (call_expression function: (identifier) arguments: (arguments))) (expression_statement (identifier)))"
        );
      });
    });
  });

  // describe(".parseTextBuffer", () => {
  //   beforeEach(() => {
  //     parser.setLanguage(JavaScript);
  //   });

  //   it("parses the contents of the given text buffer asynchronously", async () => {
  //     const elementCount = 40;
  //     const sourceCode = "[" + "0,".repeat(elementCount) + "]";
  //     const buffer = new TextBuffer(sourceCode);

  //     const tree = await parser.parseTextBuffer(buffer);
  //     const arrayNode = tree.rootNode.firstChild.firstChild;
  //     assert.equal(arrayNode.type, "array");
  //     assert.equal(arrayNode.namedChildCount, elementCount);

  //     const editIndex = 5;
  //     buffer.setTextInRange(
  //       {
  //         start: { row: 0, column: editIndex },
  //         end: { row: 0, column: editIndex },
  //       },
  //       "null,"
  //     );
  //     tree.edit({
  //       startIndex: editIndex,
  //       oldEndIndex: editIndex,
  //       newEndIndex: editIndex + 5,
  //       startPosition: { row: 0, column: editIndex },
  //       oldEndPosition: { row: 0, column: editIndex },
  //       newEndPosition: { row: 0, column: editIndex + 5 },
  //     });

  //     const newTree = await parser.parseTextBuffer(buffer, tree);
  //     const newArrayNode = newTree.rootNode.firstChild.firstChild;
  //     assert.equal(newArrayNode.type, "array");
  //     assert.equal(newArrayNode.namedChildCount, elementCount + 1);
  //   });

  //   it("does not allow the parser to be mutated while parsing", async () => {
  //     const buffer = new TextBuffer("a + b + c");
  //     const treePromise = parser.parseTextBuffer(buffer);

  //     assert.throws(() => {
  //       parser.parse("first-word");
  //     }, /Parser is in use/);

  //     assert.throws(() => {
  //       parser.setLanguage(JavaScript);
  //     }, /Parser is in use/);

  //     assert.throws(() => {
  //       parser.printDotGraphs(true);
  //     }, /Parser is in use/);

  //     const tree = await treePromise;
  //     assert.equal(
  //       tree.rootNode.toString(),
  //       "(program (expression_statement (binary_expression left: (binary_expression left: (identifier) right: (identifier)) right: (identifier))))"
  //     );

  //     parser.parse("a");
  //     parser.setLanguage(JavaScript);
  //     parser.printDotGraphs(true);
  //   });

  //   it("throws an error if the given object is not a TextBuffer", () => {
  //     assert.throws(() => {
  //       parser.parseTextBuffer({});
  //     });
  //   });

  //   it("does not try to call JS logger functions when parsing asynchronously", async () => {
  //     const messages = [];
  //     parser.setLogger((message) => messages.push(message));

  //     const tree1 = parser.parse("first-word second-word");
  //     assert(messages.length > 0);
  //     messages.length = 0;

  //     const buffer = new TextBuffer("first-word second-word");
  //     const tree2 = await parser.parseTextBuffer(buffer);
  //     assert(messages.length === 0);

  //     const tree3 = parser.parseTextBufferSync(buffer);
  //     assert(messages.length > 0);

  //     assert.equal(tree2.rootNode.toString(), tree1.rootNode.toString());
  //     assert.equal(tree3.rootNode.toString(), tree1.rootNode.toString());
  //   });

  //   describe("when the `includedRanges` option is given", () => {
  //     it("parses the text within those ranges of the string", async () => {
  //       const sourceCode = "<% foo() %> <% bar %>";

  //       const start1 = sourceCode.indexOf("foo");
  //       const end1 = start1 + 5;
  //       const start2 = sourceCode.indexOf("bar");
  //       const end2 = start2 + 3;

  //       const buffer = new TextBuffer(sourceCode);
  //       const tree = await parser.parseTextBuffer(buffer, null, {
  //         includedRanges: [
  //           {
  //             startIndex: start1,
  //             endIndex: end1,
  //             startPosition: { row: 0, column: start1 },
  //             endPosition: { row: 0, column: end1 },
  //           },
  //           {
  //             startIndex: start2,
  //             endIndex: end2,
  //             startPosition: { row: 0, column: start2 },
  //             endPosition: { row: 0, column: end2 },
  //           },
  //         ],
  //       });

  //       assert.equal(
  //         tree.rootNode.toString(),
  //         "(program (expression_statement (call_expression function: (identifier) arguments: (arguments))) (expression_statement (identifier)))"
  //       );
  //     });
  //   });
  // });

  // describe(".parseTextBufferSync", () => {
  //   it("parses the contents of the given text buffer synchronously", () => {
  //     parser.setLanguage(JavaScript);
  //     const buffer = new TextBuffer("a + b");
  //     const tree = parser.parseTextBufferSync(buffer);
  //     assert.equal(
  //       tree.rootNode.toString(),
  //       "(program (expression_statement (binary_expression left: (identifier) right: (identifier))))"
  //     );
  //   });

  //   it("returns null if no language has been set", () => {
  //     const buffer = new TextBuffer("αβ αβδ");
  //     const tree = parser.parseTextBufferSync(buffer);
  //     assert.equal(tree, null);
  //   });
  // });
});

describe("Tree", () => {
  let parser: {
    setLanguage: (arg0: any) => void;
    parse: (arg0: string, arg1: undefined) => any;
  };

  beforeEach(() => {
    parser = new Parser();
    parser.setLanguage(JavaScript);
  });

  describe(".edit", () => {
    let input, edit;

    it("updates the positions of existing nodes", () => {
      input = "abc + cde";

      let tree = parser.parse(input);
      assert.equal(
        tree.rootNode.toString(),
        "(program (expression_statement (binary_expression left: (identifier) right: (identifier))))"
      );

      const sumNode = tree.rootNode.firstChild.firstChild;
      let variableNode1 = sumNode.firstChild;
      let variableNode2 = sumNode.lastChild;
      assert.equal(variableNode1.startIndex, 0);
      assert.equal(variableNode1.endIndex, 3);
      assert.equal(variableNode2.startIndex, 6);
      assert.equal(variableNode2.endIndex, 9);

      [input, edit] = spliceInput(input, input.indexOf("bc"), 0, " * ");
      assert.equal(input, "a * bc + cde");

      tree.edit(edit);
      assert.equal(variableNode1.startIndex, 0);
      assert.equal(variableNode1.endIndex, 6);
      assert.equal(variableNode2.startIndex, 9);
      assert.equal(variableNode2.endIndex, 12);

      tree = parser.parse(input, tree);
      assert.equal(
        tree.rootNode.toString(),
        "(program (expression_statement (binary_expression left: (binary_expression left: (identifier) right: (identifier)) right: (identifier))))"
      );
    });

    it("handles non-ascii characters", () => {
      input = "αβδ + cde";

      let tree = parser.parse(input);
      assert.equal(
        tree.rootNode.toString(),
        "(program (expression_statement (binary_expression left: (identifier) right: (identifier))))"
      );

      const variableNode = tree.rootNode.firstChild.firstChild.lastChild;

      [input, edit] = spliceInput(input, input.indexOf("δ"), 0, "👍 * ");
      assert.equal(input, "αβ👍 * δ + cde");

      tree.edit(edit);
      assert.equal(variableNode.startIndex, input.indexOf("cde"));

      tree = parser.parse(input, tree);
      assert.equal(
        tree.rootNode.toString(),
        "(program (expression_statement (binary_expression left: (binary_expression left: (identifier) right: (identifier)) right: (identifier))))"
      );
    });
  });

  describe(".getEditedRange()", () => {
    it("returns the range of tokens that have been edited", () => {
      const inputString = "abc + def + ghi + jkl + mno";
      const tree = parser.parse(inputString);

      assert.equal(tree.getEditedRange(), null);

      tree.edit({
        startIndex: 7,
        oldEndIndex: 7,
        newEndIndex: 8,
        startPosition: { row: 0, column: 7 },
        oldEndPosition: { row: 0, column: 7 },
        newEndPosition: { row: 0, column: 8 },
      });

      tree.edit({
        startIndex: 21,
        oldEndIndex: 21,
        newEndIndex: 22,
        startPosition: { row: 0, column: 21 },
        oldEndPosition: { row: 0, column: 21 },
        newEndPosition: { row: 0, column: 22 },
      });

      assert.deepEqual(tree.getEditedRange(), {
        startIndex: 6,
        endIndex: 23,
        startPosition: { row: 0, column: 6 },
        endPosition: { row: 0, column: 23 },
      });
    });
  });

  describe(".getChangedRanges()", () => {
    it("reports the ranges of text whose syntactic meaning has changed", () => {
      let sourceCode = "abcdefg + hij";
      const tree1 = parser.parse(sourceCode);

      assert.equal(
        tree1.rootNode.toString(),
        "(program (expression_statement (binary_expression left: (identifier) right: (identifier))))"
      );

      sourceCode = "abc + defg + hij";
      tree1.edit({
        startIndex: 2,
        oldEndIndex: 2,
        newEndIndex: 5,
        startPosition: { row: 0, column: 2 },
        oldEndPosition: { row: 0, column: 2 },
        newEndPosition: { row: 0, column: 5 },
      });

      const tree2 = parser.parse(sourceCode, tree1);
      assert.equal(
        tree2.rootNode.toString(),
        "(program (expression_statement (binary_expression left: (binary_expression left: (identifier) right: (identifier)) right: (identifier))))"
      );

      const ranges = tree1.getChangedRanges(tree2);
      assert.deepEqual(ranges, [
        {
          startIndex: 0,
          endIndex: "abc + defg".length,
          startPosition: { row: 0, column: 0 },
          endPosition: { row: 0, column: "abc + defg".length },
        },
      ]);
    });

    it("throws an exception if the argument is not a tree", () => {
      const tree1 = parser.parse("abcdefg + hij");

      assert.throws(() => {
        tree1.getChangedRanges({});
      }, /Argument must be a tree/);
    });
  });

  describe(".walk()", () => {
    it("returns a cursor that can be used to walk the tree", () => {
      const tree = parser.parse("a * b + c / d");

      const cursor = tree.walk();
      assertCursorState(cursor, {
        nodeType: "program",
        nodeIsNamed: true,
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 0, column: 13 },
        startIndex: 0,
        endIndex: 13,
      });

      assert(cursor.gotoFirstChild());
      assertCursorState(cursor, {
        nodeType: "expression_statement",
        nodeIsNamed: true,
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 0, column: 13 },
        startIndex: 0,
        endIndex: 13,
      });

      assert(cursor.gotoFirstChild());
      assertCursorState(cursor, {
        nodeType: "binary_expression",
        nodeIsNamed: true,
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 0, column: 13 },
        startIndex: 0,
        endIndex: 13,
      });

      assert(cursor.gotoFirstChild());
      assertCursorState(cursor, {
        nodeType: "binary_expression",
        nodeIsNamed: true,
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 0, column: 5 },
        startIndex: 0,
        endIndex: 5,
      });

      assert(cursor.gotoFirstChild());
      assertCursorState(cursor, {
        nodeType: "identifier",
        nodeIsNamed: true,
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 0, column: 1 },
        startIndex: 0,
        endIndex: 1,
      });

      assert(!cursor.gotoFirstChild());
      assert(cursor.gotoNextSibling());
      assertCursorState(cursor, {
        nodeType: "*",
        nodeIsNamed: false,
        startPosition: { row: 0, column: 2 },
        endPosition: { row: 0, column: 3 },
        startIndex: 2,
        endIndex: 3,
      });

      assert(cursor.gotoNextSibling());
      assertCursorState(cursor, {
        nodeType: "identifier",
        nodeIsNamed: true,
        startPosition: { row: 0, column: 4 },
        endPosition: { row: 0, column: 5 },
        startIndex: 4,
        endIndex: 5,
      });

      assert(!cursor.gotoNextSibling());
      assert(cursor.gotoParent());
      assertCursorState(cursor, {
        nodeType: "binary_expression",
        nodeIsNamed: true,
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 0, column: 5 },
        startIndex: 0,
        endIndex: 5,
      });

      assert(cursor.gotoNextSibling());
      assertCursorState(cursor, {
        nodeType: "+",
        nodeIsNamed: false,
        startPosition: { row: 0, column: 6 },
        endPosition: { row: 0, column: 7 },
        startIndex: 6,
        endIndex: 7,
      });

      assert(cursor.gotoNextSibling());
      assertCursorState(cursor, {
        nodeType: "binary_expression",
        nodeIsNamed: true,
        startPosition: { row: 0, column: 8 },
        endPosition: { row: 0, column: 13 },
        startIndex: 8,
        endIndex: 13,
      });

      const childIndex = cursor.gotoFirstChildForIndex(12);
      assertCursorState(cursor, {
        nodeType: "identifier",
        nodeIsNamed: true,
        startPosition: { row: 0, column: 12 },
        endPosition: { row: 0, column: 13 },
        startIndex: 12,
        endIndex: 13,
      });
      assert.equal(childIndex, 2);

      assert(!cursor.gotoNextSibling());
      assert(cursor.gotoParent());
      assert(cursor.gotoParent());
      assert(cursor.gotoParent());
      assert(cursor.gotoParent());
      assert(!cursor.gotoParent());
    });

    it("returns a cursor that can be reset anywhere in the tree", () => {
      const tree = parser.parse("a * b + c / d");
      const cursor = tree.walk();
      const root = tree.rootNode.firstChild;

      cursor.reset(root.firstChild.firstChild);
      assertCursorState(cursor, {
        nodeType: "binary_expression",
        nodeIsNamed: true,
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 0, column: 5 },
        startIndex: 0,
        endIndex: 5,
      });

      cursor.gotoFirstChild();
      assertCursorState(cursor, {
        nodeType: "identifier",
        nodeIsNamed: true,
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 0, column: 1 },
        startIndex: 0,
        endIndex: 1,
      });

      assert(cursor.gotoParent());
      assert(!cursor.gotoParent());
    });
  });
});

describe("Query", () => {
  const parser = new Parser();
  parser.setLanguage(JavaScript);

  describe("new", () => {
    it("works with string", () => {
      const query = new Query(
        JavaScript,
        `
        (function_declaration name: (identifier) @fn-def)
        (call_expression function: (identifier) @fn-ref)
      `
      );
    });

    it("works with Buffer", () => {
      const query = new Query(
        JavaScript,
        Buffer.from(`
        (function_declaration name: (identifier) @fn-def)
        (call_expression function: (identifier) @fn-ref)
      `)
      );
    });
  });

  describe(".matches", () => {
    it("returns all of the matches for the given query", () => {
      const tree = parser.parse(
        "function one() { two(); function three() {} }"
      );
      const query = new Query(
        JavaScript,
        `
        (function_declaration name: (identifier) @fn-def)
        (call_expression function: (identifier) @fn-ref)
      `
      );
      const matches = query.matches(tree.rootNode);
      assert.deepEqual(formatMatches(tree, matches), [
        { pattern: 0, captures: [{ name: "fn-def", text: "one" }] },
        { pattern: 1, captures: [{ name: "fn-ref", text: "two" }] },
        { pattern: 0, captures: [{ name: "fn-def", text: "three" }] },
      ]);
    });

    it("can search in a specified ranges", () => {
      const tree = parser.parse("[a, b,\nc, d,\ne, f,\ng, h]");
      const query = new Query(JavaScript, "(identifier) @element");
      const matches = query.matches(
        tree.rootNode,
        { row: 1, column: 1 },
        { row: 3, column: 1 }
      );
      assert.deepEqual(formatMatches(tree, matches), [
        { pattern: 0, captures: [{ name: "element", text: "d" }] },
        { pattern: 0, captures: [{ name: "element", text: "e" }] },
        { pattern: 0, captures: [{ name: "element", text: "f" }] },
        { pattern: 0, captures: [{ name: "element", text: "g" }] },
      ]);
    });

    it("finds optional nodes even when using #eq? predicate", () => {
      const tree = parser.parse(`
        { one: true };
        { one: true, two: true };
      `);
      const query = new Query(
        JavaScript,
        `
        (
          (object (pair key: (property_identifier) @a) (pair key: (property_identifier) @b)?)
          (#eq? @a one)
          (#eq? @b two)
        )
      `
      );
      const matches = query.matches(tree.rootNode);
      assert.deepEqual(formatMatches(tree, matches), [
        { pattern: 0, captures: [{ name: "a", text: "one" }] },
        {
          pattern: 0,
          captures: [
            { name: "a", text: "one" },
            { name: "b", text: "two" },
          ],
        },
      ]);
    });
  });

  describe(".captures", () => {
    it("returns all of the captures for the given query, in order", () => {
      const tree = parser.parse(`
        a({
          bc: function de() {
            const fg = function hi() {}
          },
          jk: function lm() {
            const no = function pq() {}
          },
        });
      `);
      const query = new Query(
        JavaScript,
        `
        (pair
          key: _ @method.def
          (function
            name: (identifier) @method.alias))
        (variable_declarator
          name: _ @function.def
          value: (function
            name: (identifier) @function.alias))
        ":" @delimiter
        "=" @operator
      `
      );

      const captures = query.captures(tree.rootNode);
      assert.deepEqual(formatCaptures(tree, captures), [
        { name: "method.def", text: "bc" },
        { name: "delimiter", text: ":" },
        { name: "method.alias", text: "de" },
        { name: "function.def", text: "fg" },
        { name: "operator", text: "=" },
        { name: "function.alias", text: "hi" },
        { name: "method.def", text: "jk" },
        { name: "delimiter", text: ":" },
        { name: "method.alias", text: "lm" },
        { name: "function.def", text: "no" },
        { name: "operator", text: "=" },
        { name: "function.alias", text: "pq" },
      ]);
    });

    it("handles conditions that compare the text of capture to literal strings", () => {
      const tree = parser.parse(`
        const ab = require('./ab');
        new Cd(EF);
      `);

      const query = new Query(
        JavaScript,
        `
        (identifier) @variable
        ((identifier) @function.builtin
         (#eq? @function.builtin "require"))
        ((identifier) @constructor
         (#match? @constructor "^[A-Z]"))
        ((identifier) @constant
         (#match? @constant "^[A-Z]{2,}$"))
      `
      );

      const captures = query.captures(tree.rootNode);
      assert.deepEqual(formatCaptures(tree, captures), [
        { name: "variable", text: "ab" },
        { name: "variable", text: "require" },
        { name: "function.builtin", text: "require" },
        { name: "variable", text: "Cd" },
        { name: "constructor", text: "Cd" },
        { name: "variable", text: "EF" },
        { name: "constructor", text: "EF" },
        { name: "constant", text: "EF" },
      ]);
    });

    it("handles conditions that compare the text of capture to each other", () => {
      const tree = parser.parse(`
        ab = abc + 1;
        def = de + 1;
        ghi = ghi + 1;
      `);

      const query = new Query(
        JavaScript,
        `
        (
          (assignment_expression
            left: (identifier) @id1
            right: (binary_expression
              left: (identifier) @id2))
          (#eq? @id1 @id2)
        )
      `
      );

      const captures = query.captures(tree.rootNode);
      assert.deepEqual(formatCaptures(tree, captures), [
        { name: "id1", text: "ghi" },
        { name: "id2", text: "ghi" },
      ]);
    });

    it("handles patterns with properties", () => {
      const tree = parser.parse(`a(b.c);`);
      const query = new Query(
        JavaScript,
        `
        ((call_expression (identifier) @func)
         (#set! foo)
         (#set! bar baz))
        ((property_identifier) @prop
         (#is? foo)
         (#is-not? bar baz))
      `
      );

      const captures = query.captures(tree.rootNode);
      assert.deepEqual(formatCaptures(tree, captures), [
        { name: "func", text: "a", setProperties: { foo: null, bar: "baz" } },
        {
          name: "prop",
          text: "c",
          assertedProperties: { foo: null },
          refutedProperties: { bar: "baz" },
        },
      ]);
    });
  });
});

function formatMatches(tree: any, matches: { pattern: any; captures: any }[]) {
  return matches.map(({ pattern, captures }) => ({
    pattern,
    captures: formatCaptures(tree, captures),
  }));
}

function formatCaptures(
  tree: { getText: (arg0: any) => any },
  captures: any[]
) {
  return captures.map((c: { node: any; text: any }) => {
    const node = c.node;
    delete c.node;
    c.text = tree.getText(node);
    return c;
  });
}

function assertCursorState(
  cursor: {
    nodeType: any;
    nodeIsNamed: any;
    startPosition: any;
    endPosition: any;
    startIndex: any;
    endIndex: any;
    currentNode: any;
  },
  params: {
    nodeType: any;
    nodeIsNamed: any;
    startPosition: any;
    endPosition: any;
    startIndex: any;
    endIndex: any;
  }
) {
  assert.equal(cursor.nodeType, params.nodeType);
  assert.equal(cursor.nodeIsNamed, params.nodeIsNamed);
  assert.deepEqual(cursor.startPosition, params.startPosition);
  assert.deepEqual(cursor.endPosition, params.endPosition);
  assert.deepEqual(cursor.startIndex, params.startIndex);
  assert.deepEqual(cursor.endIndex, params.endIndex);

  const node = cursor.currentNode;
  assert.equal(node.type, params.nodeType);
  assert.equal(node.isNamed, params.nodeIsNamed);
  assert.deepEqual(node.startPosition, params.startPosition);
  assert.deepEqual(node.endPosition, params.endPosition);
  assert.deepEqual(node.startIndex, params.startIndex);
  assert.deepEqual(node.endIndex, params.endIndex);
}

function spliceInput(
  input: string | any[],
  startIndex: number,
  lengthRemoved: number,
  newText: string | any[]
) {
  const oldEndIndex = startIndex + lengthRemoved;
  const newEndIndex = startIndex + newText.length;
  const startPosition = getExtent(input.slice(0, startIndex));
  const oldEndPosition = getExtent(input.slice(0, oldEndIndex));
  input = input.slice(0, startIndex) + newText + input.slice(oldEndIndex);
  const newEndPosition = getExtent(input.slice(0, newEndIndex));
  return [
    input,
    {
      startIndex,
      startPosition,
      oldEndIndex,
      oldEndPosition,
      newEndIndex,
      newEndPosition,
    },
  ];
}

function getExtent(text: string | string[]) {
  let row = 0;
  let index;
  for (index = 0; index != -1; index = text.indexOf("\n", index)) {
    index++;
    row++;
  }
  return { row, column: text.length - index };
}
