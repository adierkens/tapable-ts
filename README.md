# tapable-ts

A TypeScript rewrite of [tapable](https://github.com/webpack/tapable)

## Tapable

`tapable` is a great plugin system from webpack that enables users to expose _hooks_ from modules within your app that plugins can _tap_ into and customize the behavior. I use it in almost all of my projects, but there are a few quirks with the original that made it hard to use in other applications:

- Ability to _untap_ a hook -- This wasn't a feature that the webpack authors needed, and their optimizations for webpack's use-case made it difficult to implement in the original library.
