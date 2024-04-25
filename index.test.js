import assert from "node:assert";
import {describe, it} from "node:test";
import {sortKind, fuzzy, search, Searcher} from "./index.js";

/* global describe, it */


describe("fuzzy", () => {
	it("should score exact matches perfectly", () => {
		assert(fuzzy("hello", "hello") === 1);
	
		assert(fuzzy("goodbye", "goodbye") === 1);
	});

	it("should score exact substring matches perfectly", () => {
		assert(fuzzy("hello", "hello there") === 1);
		assert(fuzzy("goodbye", "well, goodbye then") === 1);
	});

	it("should score close matches highly", () => {
		assert(fuzzy("help", "hello") > 0.5);
		assert(fuzzy("goodie", "goodbye") > 0.5);
	});

	it("should score poor matches poorly", () => {
		assert(fuzzy("hello", "goodbye") < 0.5);
		assert(fuzzy("goodbye", "hello") < 0.5);
	});

	it("should score non-matches minimally", () => {
		assert(fuzzy("hello", "pigs and stuff") === 0);
		assert(fuzzy("goodbye", "cars plus trucks") === 0);
	});

	it("should return perfect scores for empty search terms", () => {
		assert(fuzzy("", "anything") === 1);
	});

	it("should return minimum scores for empty candidates", () => {
		assert(fuzzy("nothing", "") === 0);
	});

	it("should handle unicode well", () => {
		// unicode characters are normalized
		assert(fuzzy("\u212B", "\u0041\u030A") === 1);
		// handles high and low surrogates as single characters
		assert(fuzzy("high", "h💩gh") === 0.75);
		// handles combining marks as single characters
		assert(fuzzy("hi zalgo hello hello", "hi Z͑ͫ̓ͪ̂ͫ̽͏̴̙̤̞͉͚̯̞̠͍A̴̵̜̰͔ͫ͗͢L̠ͨͧͩ͘G̴̻͈͍͔̹̑͗̎̅͛́Ǫ̵̹̻̝̳͂̌̌͘ hello hello") === 0.75);
		// handles graphemes such as hangul jamo and joined emoji as single characters
		assert(fuzzy("high", "h깍👨‍👩‍👧‍👦h") === 0.5);
	});

	it("should handle unicode well(with useSeparatedUnicode)", () => {
		const options = {useSeparatedUnicode: true};
		// unicode characters are normalized
		assert(fuzzy("\u212B", "\u0041\u030A", options) === 1);
		// handles high and low surrogates as multiple characters
		assert(fuzzy("high", "h💩gh", options) === 0.5);
		// handles combining marks as single characters
		assert(fuzzy("hi zalgo hello hello", "hi Z͑ͫ̓ͪ̂ͫ̽͏̴̙̤̞͉͚̯̞̠͍A̴̵̜̰͔ͫ͗͢L̠ͨͧͩ͘G̴̻͈͍͔̹̑͗̎̅͛́Ǫ̵̹̻̝̳͂̌̌͘ hello hello", options) === 0.6);
		// handles graphemes such as hangul jamo and joined emoji as multiple characters
		assert(fuzzy("high", "h깍👨‍👩‍👧‍👦h", options) === 0.25);
		// handles hangul jamo as multiple characters
		assert(fuzzy("ㅅㄹ", "사랑", options) === 0.5);
	});

	describe("options", () => {
		it("should have different results when ignoreCase is set", () => {
			assert(
				fuzzy("hello", "HELLO", {ignoreCase: true}) >
				fuzzy("hello", "HELLO", {ignoreCase: false}),
			);
		});

		it("should have different results when ignoreSymbols is set", () => {
			assert(
				fuzzy("hello", "h..e..l..l..o", {ignoreSymbols: true}) >
				fuzzy("hello", "h..e..l..l..o", {ignoreSymbols: false}),
			);
		});

		it("should have different results when normalizeWhitespace is set", () => {
			assert(
				fuzzy("a b c d", "a  b  c  d", {normalizeWhitespace: true}) >
				fuzzy("a b c d", "a  b  c  d", {normalizeWhitespace: false}),
			);
		});

		it("should have different results when useDamerau is set", () => {
			assert(fuzzy("abcd", "acbd", {useDamerau: false}) === 0.5);
			assert(fuzzy("abcd", "acbd", {useDamerau: true}) === 0.75);
		});

		it("should return match data when returnMatchData is set", () => {
			assert.deepStrictEqual(fuzzy("abcd", "acbd", {returnMatchData: true}), {
				item: "acbd",
				original: "acbd",
				key: "acbd",
				score: 0.75,
				match: {index: 0, length: 4},
			});
		});

		it("should map matches to their original positions", () => {
			assert.deepStrictEqual(fuzzy("hello", "  h..e..l..l  ..o", {returnMatchData: true}), {
				item: "  h..e..l..l  ..o",
				original: "  h..e..l..l  ..o",
				key: "hell o",
				score: 0.8,
				match: {index: 2, length: 10},
			});
		});

	/*	it("should allow normal levenshtein", () => {
			const options = {useSellers: false};
			assert(fuzzy("hello", "hello", options) === 1);
			assert(fuzzy("hello", "he", options) === 0.4);
			assert(fuzzy("he", "hello", options) === 0.4);
		});*/
	});
});

describe("search", () => {
	it("should filter out low matches", () => {
		assert.deepStrictEqual(search("hello", ["goodbye"]), []);
	});

	it("should have good relative ordering", () => {
		// test order by closeness of match
		assert.deepStrictEqual(
			search("item", ["items", "iterator", "itemize", "item", "temperature"]),
			["item", "items", "itemize", "iterator", "temperature"],
		);

		// test order by earliness of match
		assert.deepStrictEqual(
			search("item", ["lineitem", "excitement", "itemize", "item"]),
			["item", "itemize", "excitement", "lineitem"],
		);
	});

	it("should handle empty candidates", () => {
		assert.doesNotThrow(() => search("x", [""]));
	});

	it("should handle unicode well", () => {
		const options = {returnMatchData: true};
		const tSearch = (a, b) => search(a, [b], options)[0].score;
		// unicode characters are normalized
		assert(tSearch("\u212B", "\u0041\u030A") === 1);
		// handles high and low surrogates as single characters
		assert(tSearch("high", "h💩gh") === 0.75);
		// handles combining marks as single characters
		assert(tSearch("hi zalgo hello hello", "hi Z͑ͫ̓ͪ̂ͫ̽͏̴̙̤̞͉͚̯̞̠͍A̴̵̜̰͔ͫ͗͢L̠ͨͧͩ͘G̴̻͈͍͔̹̑͗̎̅͛́Ǫ̵̹̻̝̳͂̌̌͘ hello hello") === 0.75);
		// handles graphemes such as hangul jamo and joined emoji as single characters
		assert(tSearch("abcde", "abc깍👨‍👩‍👧‍👦") === 0.6);
	});

	it("should handle unicode well(with useSeparatedUnicode)", () => {
		const options = {returnMatchData: true, useSeparatedUnicode: true, threshold: 0.5};
		const tSearch = (a, b) => search(a, [b], options)[0].score;
		// unicode characters are normalized
		assert(tSearch("\u212B", "\u0041\u030A") === 1);
		// handles high and low surrogates as multiple characters
		assert(tSearch("high", "h💩gh") === 0.5);
		// handles combining marks as multiple characters
		assert(tSearch("hi zalgo hello hello", "hi Z͑ͫ̓ͪ̂ͫ̽͏̴̙̤̞͉͚̯̞̠͍A̴̵̜̰͔ͫ͗͢L̠ͨͧͩ͘G̴̻͈͍͔̹̑͗̎̅͛́Ǫ̵̹̻̝̳͂̌̌͘ hello hello") === 0.6);
		// handles graphemes such as hangul jamo and joined emoji as multiple characters
		assert(tSearch("abcde", "abc깍👨‍👩‍👧‍👦") === 0.6);
		// handles hangul jamo as multiple characters
		assert(tSearch("ㅅㄹ", "사랑") === 0.5);
	});

	describe("options", () => {
		// here we describe the search specific options
		// the other options were tested with fuzzy
	/*	it("should work with objects when keySelector is provided", () => {
			assert.throws(() => search("hello", [{name: "hello"}]));
			assert.doesNotThrow(() => {
				search("hello", [{name: "hello"}], {keySelector: ({name}) => name});
			});
			assert.deepStrictEqual(
				search("hello", [{name: "hello"}], {keySelector: ({name}) => name}),
				[{name: "hello"}],
			);
		}); */

		it("should have good ordering when using multiple keys per object", () => {
			assert.deepStrictEqual(
				search("grin", [["grinning", "grin"], ["grin", "grinning"]]),
				[["grin", "grinning"], ["grinning", "grin"]],
			);

			assert.deepStrictEqual(
				search("laugh", [["smile", "laughing"], ["laughing"], ["laugh"]]),
				[["laugh"], ["laughing"], ["smile", "laughing"]],
			);
		});

		it("should handle searching multiple keys per object", () => {
			assert.doesNotThrow(() => {
				search(
					"hello",
					[{name: "hello", value: "world"}],
					{keySelector: ({name, value}) => [name, value]},
				);
			});
			assert.deepStrictEqual(search(
				"hello",
				[
					{name: "hello", value: "jell"},
					{name: "world", value: "hello"},
				],
				{keySelector: ({name, value}) => [name, value]},
			), [{name: "hello", value: "jell"}, {name: "world", value: "hello"}]);
		});

		it("should have more results when threshold is lower", () => {
			assert(
				search("aaa", ["aaa", "aab", "abb", "bbb"], {threshold: .3}).length >
				search("aaa", ["aaa", "aab", "abb", "bbb"], {threshold: .7}).length,
			);
		});

		it("should return match data when returnMatchData is set", () => {
			assert.deepStrictEqual(search("hello", ["hello"])[0].score, undefined);
			assert.deepStrictEqual(
				search("hello", ["hello"], {returnMatchData: true})[0],
				{
					item: "hello",
					original: "hello",
					key: "hello",
					score: 1,
					match: {index: 0, length: 5},
				},
			);
		});

	/*	it("should allow normal levenshtein", () => {
			const options = {useSellers: false};
			assert.deepStrictEqual(
				search("hello", ["hello"], options),
				["hello"],
			);
			assert.deepStrictEqual(
				search("hello", ["he"], options),
				["he"],
			);
			assert.deepStrictEqual(
				search("he", ["hello"], options),
				["he"],
			);
		}); */

		it("should allow changing sortBy", () => {
			const candidates = ["hi there", "hello there"];
			assert.deepStrictEqual(
				search("hello there", candidates, {sortBy: sortKind.bestMatch}),
				["hello there", "hi there"],
			);
			assert.deepStrictEqual(
				search("hello there", candidates, {sortBy: sortKind.insertOrder}),
				["hi there", "hello there"],
			);
		});
	});
});

describe("Searcher", () => {
	it("should return the same results as search", () => {
		const searcher = new Searcher(["hello", "help", "goodbye"]);
		assert.deepStrictEqual(
			search("hello", ["hello", "help", "goodbye"]),
			searcher.search("hello"),
		);
	});

	it("should work more than once", () => {
		const searcher = new Searcher(["aaa", "aab", "abb", "bbb"]);
		assert.deepStrictEqual(searcher.search("aaa"), ["aaa", "aab"]);
		assert.deepStrictEqual(searcher.search("bbb"), ["bbb", "abb"]);
		assert.deepStrictEqual(searcher.search("ccc"), []);
	});

	it("should have different behavior with different options", () => {
		// we only really have to test one option, as the more strict
		// tests are handled in search/fuzzy
		// this is really just making sure the options are set
		assert.deepStrictEqual(new Searcher(["HELLO"], {ignoreCase: false}).search("hello"), []);
		assert.deepStrictEqual(
			new Searcher(["HELLO"], {ignoreCase: true}).search("hello"),
			["HELLO"],
		);
	});

	it("should allow overriding threshold", () => {
		const searcher = new Searcher(["aaa", "aab", "abb", "bbb"], {threshold: .3});
		assert(
			searcher.search("aaa").length >
			searcher.search("aaa", {threshold: .7}).length,
		);
	});
});
