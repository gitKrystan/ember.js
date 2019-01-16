/*

setup + peekwatching = 0 => noop
get => addDepKey (ref count = 1)
get => noop (ref count = 1)
willWatch => noop (ref count = 1) (would have been addDepKey, ref count = 2)
didUnwatch => removeDepKey (ref count = 0) (would have been removeDepKey, ref count = 1)





*/




import {
  alias,
  defineProperty,
  get,
  set,
  isWatching,
  addObserver,
  removeObserver,
  tagFor,
  tagForProperty
} from '..';
import { meta } from '@ember/-internals/meta';
import { moduleFor, AbstractTestCase } from 'internal-test-helpers';

let obj, count;

function incrementCount() {
  debugger;
  count++;
}

moduleFor(
  '@ember/-internals/metal/alias',
  class extends AbstractTestCase {
    beforeEach() {
      obj = { foo: { faz: 'FOO' } };
      count = 0;
    }

    afterEach() {
      obj = null;
    }

    ['@test should proxy get to alt key'](assert) {
      defineProperty(obj, 'bar', alias('foo.faz'));
      assert.equal(get(obj, 'bar'), 'FOO');
    }

    ['@test should proxy set to alt key'](assert) {
      defineProperty(obj, 'bar', alias('foo.faz'));
      set(obj, 'bar', 'BAR');
      assert.equal(get(obj, 'foo.faz'), 'BAR');
    }

    ['@test old dependent keys should not trigger property changes'](assert) {
      let obj1 = Object.create(null);
      defineProperty(obj1, 'foo', null, null);
      defineProperty(obj1, 'bar', alias('foo'));
      defineProperty(obj1, 'baz', alias('foo'));
      defineProperty(obj1, 'baz', alias('bar')); // redefine baz
      addObserver(obj1, 'baz', incrementCount);

      set(obj1, 'foo', 'FOO');
      assert.equal(count, 1);

      removeObserver(obj1, 'baz', incrementCount);

      set(obj1, 'foo', 'OOF');
      assert.equal(count, 1);
    }

    [`@test inheriting an observer of the alias from the prototype then
    redefining the alias on the instance to another property dependent on same key
    does not call the observer twice`](assert) {
      let obj1 = Object.create(null);
      obj1.incrementCount = incrementCount;

      meta(obj1).proto = obj1;

      defineProperty(obj1, 'foo', null, null);
      defineProperty(obj1, 'bar', alias('foo'));
      defineProperty(obj1, 'baz', alias('foo'));
      addObserver(obj1, 'baz', null, 'incrementCount');

      let obj2 = Object.create(obj1);
      defineProperty(obj2, 'baz', alias('bar')); // override baz

      set(obj2, 'foo', 'FOO');
      assert.equal(count, 1);

      removeObserver(obj2, 'baz', null, 'incrementCount');

      set(obj2, 'foo', 'OOF');
      assert.equal(count, 1);
    }

    ['@test an observer of the alias works if added after defining the alias'](assert) {
      defineProperty(obj, 'bar', alias('foo.faz'));
      addObserver(obj, 'bar', incrementCount);
      assert.ok(isWatching(obj, 'foo.faz'));
      set(obj, 'foo.faz', 'BAR');
      assert.equal(count, 1);
    }

    ['@test an observer of the alias works if added before defining the alias'](assert) {
      addObserver(obj, 'bar', incrementCount);
      defineProperty(obj, 'bar', alias('foo.faz'));
      assert.ok(isWatching(obj, 'foo.faz'));
      set(obj, 'foo.faz', 'BAR');
      assert.equal(count, 1);
    }

    ['@test object with alias is dirtied if interior object of alias is set after consumption'](
      assert
    ) {
      defineProperty(obj, 'bar', alias('foo.faz'));
      get(obj, 'bar');

      let tag = tagFor(obj);
      let tagValue = tag.value();
      set(obj, 'foo.faz', 'BAR');

      assert.ok(!tag.validate(tagValue), 'setting the aliased key should dirty the object');
    }

    ['@test setting alias on self should fail assertion']() {
      expectAssertion(
        () => defineProperty(obj, 'bar', alias('bar')),
        "Setting alias 'bar' on self"
      );
    }

    ['@test destroyed alias does not disturb watch count'](assert) {
      defineProperty(obj, 'bar', alias('foo.faz'));

      assert.equal(get(obj, 'bar'), 'FOO');
      assert.ok(isWatching(obj, 'foo.faz'));

      defineProperty(obj, 'bar', null);

      assert.notOk(isWatching(obj, 'foo.faz'));
    }

    ['@test setting on oneWay alias does not disturb watch count'](assert) {
      defineProperty(obj, 'bar', alias('foo.faz').oneWay());

      assert.equal(get(obj, 'bar'), 'FOO');
      assert.ok(isWatching(obj, 'foo.faz'));

      set(obj, 'bar', null);

      assert.notOk(isWatching(obj, 'foo.faz'));
    }

    ['@test redefined alias with observer does not disturb watch count'](assert) {
      defineProperty(obj, 'bar', alias('foo.faz').oneWay());

      assert.equal(get(obj, 'bar'), 'FOO');
      assert.ok(isWatching(obj, 'foo.faz'));

      addObserver(obj, 'bar', incrementCount);

      assert.equal(count, 0);

      set(obj, 'bar', null);

      assert.equal(count, 1);
      assert.notOk(isWatching(obj, 'foo.faz'));

      defineProperty(obj, 'bar', alias('foo.faz'));

      assert.equal(count, 1);
      assert.ok(isWatching(obj, 'foo.faz'));

      set(obj, 'foo.faz', 'great');

      assert.equal(count, 2);
    }

    ['@test unbalanced watch count'](assert) {
      let watcher = {};
      defineProperty(watcher, 'lol', alias('inner.farfignugent'));

      let test = {};
      defineProperty(test, 'farfignugent', alias('bar'));

      let tag = tagForProperty(test, 'farfignugent');
      let tagValue = null;

      function assertTagChanged() {
        let newValue = tag.value();
        assert.notEqual(newValue, tagValue);
        tagValue = newValue;
      }

      assertTagChanged();

      assert.equal(get(test, 'farfignugent'), undefined);

      set(watcher, 'inner', test);
      assert.equal(get(watcher, 'lol'), undefined);

      set(test, 'bar', 10);
      assertTagChanged();
      assert.equal(get(test, 'farfignugent'), 10);
      assert.equal(get(watcher, 'lol'), 10);

      set(watcher, 'inner', null);
      assert.equal(get(watcher, 'lol'), undefined);

      set(test, 'bar', 20);
      assertTagChanged();
      assert.equal(get(test, 'farfignugent'), 20);

    }
  }
);
