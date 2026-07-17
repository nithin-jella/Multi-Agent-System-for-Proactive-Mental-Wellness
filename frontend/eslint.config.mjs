import next from "eslint-config-next";

const eslintConfig = [
	...next,
	{
		rules: {
			// Keep these as warnings during React 19 migration; behavior is still verified by QA/tests.
			"react/no-unescaped-entities": "warn",
			"react-hooks/set-state-in-effect": "warn",
			"react-hooks/static-components": "warn",
			"react-hooks/purity": "warn",
			"react-hooks/immutability": "warn",
		},
	},
];

export default eslintConfig;
