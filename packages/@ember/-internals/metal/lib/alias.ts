import { Meta, meta as metaFor } from '@ember/-internals/meta';
import { inspect } from '@ember/-internals/utils';
import { assert } from '@ember/debug';
import EmberError from '@ember/error';
import { ComputedProperty } from './computed';
import { getCachedValueFor, getCacheFor } from './computed_cache';
import {
  addDependentKeys,
  DescriptorWithDependentKeys,
  removeDependentKeys,
} from './dependent_keys';
import { defineProperty, Descriptor } from './properties';
import { get } from './property_get';
import { set } from './property_set';

const CONSUMED = Object.freeze({});

export default function alias(altKey: string): AliasedProperty {
  return new AliasedProperty(altKey);
}

export class AliasedProperty extends Descriptor implements DescriptorWithDependentKeys {
  readonly _dependentKeys: string[];
  readonly altKey: string;

  constructor(altKey: string) {
    super();
    this.altKey = altKey;
    this._dependentKeys = [altKey];
    this._didAddInSetup = false;
  }

  setup(obj: object, keyName: string, meta: Meta): void {
    assert(`Setting alias '${keyName}' on self`, this.altKey !== keyName);
    console.log('setup', obj, keyName, meta.peekWatching(this.altKey));
    super.setup(obj, keyName, meta);
    if (meta.peekWatching(keyName) > 0) {
      this.consume(obj, keyName, meta);
    }
    console.log('after setup', obj, keyName, meta.peekWatching(this.altKey));
  }

  teardown(obj: object, keyName: string, meta: Meta): void {
    console.log('teardown', obj, keyName, meta.peekWatching(this.altKey));
    let cache = getCacheFor(obj);
    if (cache.get(keyName) === CONSUMED || meta.peekWatching(keyName) > 0) {
      cache.delete(keyName);
      removeDependentKeys(this, obj, keyName, meta);
    }
    super.teardown(obj, keyName, meta);
    console.log('after teardown', obj, keyName, meta.peekWatching(this.altKey));
  }

  willWatch(obj: object, keyName: string, meta: Meta): void {
    debugger;
    console.log('willWatch', obj, keyName, meta.peekWatching(this.altKey));
    this.consume(obj, keyName, meta);
    console.log('after willWatch', obj, keyName, meta.peekWatching(this.altKey));
  }

  didUnwatch(obj: object, keyName: string, meta: Meta): void {
    console.log('didUnwatch', obj, keyName, meta.peekWatching(this.altKey));
  //   removeDependentKeys(this, obj, keyName, meta);
  //   console.log('after didUnwatch', obj, keyName, meta.peekWatching(this.altKey));
  }

  get(obj: object, keyName: string): any {
    let meta = metaFor(obj);
    console.log('get', obj, keyName, meta.peekWatching(this.altKey));
    let ret = get(obj, this.altKey);
    this.consume(obj, keyName, metaFor(obj));
    console.log('after get', obj, keyName, meta.peekWatching(this.altKey));
    return ret;
  }

  consume(obj: object, keyName: string, meta: Meta): void {
    let cache = getCacheFor(obj);
    if (cache.get(keyName) !== CONSUMED) {
      cache.set(keyName, CONSUMED);
      addDependentKeys(this, obj, keyName, meta);
    }
  }

  set(obj: object, _keyName: string, value: any): any {
    return set(obj, this.altKey, value);
  }

  readOnly(): this {
    this.set = AliasedProperty_readOnlySet;
    return this;
  }

  oneWay(): this {
    this.set = AliasedProperty_oneWaySet;
    return this;
  }
}

function AliasedProperty_readOnlySet(obj: object, keyName: string): never {
  // eslint-disable-line no-unused-vars
  throw new EmberError(`Cannot set read-only property '${keyName}' on object: ${inspect(obj)}`);
}

function AliasedProperty_oneWaySet(obj: object, keyName: string, value: any): any {
  defineProperty(obj, keyName, null);
  return set(obj, keyName, value);
}

// Backwards compatibility with Ember Data.
(AliasedProperty.prototype as any)._meta = undefined;
(AliasedProperty.prototype as any).meta = ComputedProperty.prototype.meta;
