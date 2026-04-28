import { extractJsonArray } from './jsonExtract.js';

describe('extractJsonArray', () => {
  it('parses a clean JSON array', () => {
    expect(extractJsonArray('[1, 2, 3]')).toEqual([1, 2, 3]);
  });

  it('parses an array of objects', () => {
    const raw = '[{"title": "a"}, {"title": "b"}]';
    expect(extractJsonArray(raw)).toEqual([{ title: 'a' }, { title: 'b' }]);
  });

  it('strips a json-fenced markdown code block', () => {
    const raw = 'Here are the results:\n```json\n[{"x": 1}]\n```\nDone.';
    expect(extractJsonArray(raw)).toEqual([{ x: 1 }]);
  });

  it('strips an unlabeled markdown code block', () => {
    const raw = '```\n[10, 20]\n```';
    expect(extractJsonArray(raw)).toEqual([10, 20]);
  });

  it('extracts an array embedded in surrounding prose', () => {
    const raw = 'Sure — here you go: [{"a": 1}, {"a": 2}] hope that helps.';
    expect(extractJsonArray(raw)).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it('returns an empty array when no JSON array is found', () => {
    expect(extractJsonArray('Sorry, I cannot help with that.')).toEqual([]);
  });

  it('returns an empty array when content parses to an object instead of an array', () => {
    expect(extractJsonArray('{"insights": []}')).toEqual([]);
  });

  it('handles whitespace and trailing content gracefully', () => {
    expect(extractJsonArray('   \n[1,2]\n\n trailing junk ')).toEqual([1, 2]);
  });
});
