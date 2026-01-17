Please use `bun` for installing packages and `bunx` for running scripts. Do not use `npm` or `yarn`.

Use the installed shadcn/ui components. Stick to the tailwind theme colours that are provided by shadcn/ui
and avoid using your own custom colours.

## Linting Guidelines

Run `bun run lint` to the lint the codebase after you make changes.

Always follow best practices when using React. For example, do not call `setState` synchronously inside `useEffect`.
Initialize state with the correct value upfront instead of setting it inside an effect.
For derived state that depends on other values, use `useMemo` instead of `useEffect` + `setState`.

You do NOT need to fix linting errors in `@/components/ui` as these are shadcn/ui components and the errors are to be expected.
