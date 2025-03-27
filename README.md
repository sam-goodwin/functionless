Functionless is an attempt to compile TypeScript code into AWS Cloud Formation.

It primarily focused on transforming a TypeScript function into an AWS Step Function workflow definition, but Step Functions weren't Turing Complete (lacked JSONAta back then), so ultimately failed.

The lesson learned from this project is to find solutions that don't necessitate static analysis and compiler tools. "Don't fight your language".
