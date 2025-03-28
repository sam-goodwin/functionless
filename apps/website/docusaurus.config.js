// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const codeTheme = require("./src/theme/code-theme");

const url =
  process.env.CONTEXT === "deploy-preview" && process.env.DEPLOY_PRIME_URL
    ? process.env.DEPLOY_PRIME_URL
    : "https://functionless.org";

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: "Functionless",
  tagline: "Unified Infrastructure and Application Code",
  // use the deploy url when building for preview
  // https://docs.netlify.com/configure-builds/environment-variables/#read-only-variables
  url,
  baseUrl: "/",
  onBrokenLinks: "throw",
  onBrokenMarkdownLinks: "warn",
  favicon: "img/logo/logo_dark_icon.svg",
  organizationName: "functionless",
  projectName: "functionless",
  // see: https://www.npmjs.com/package/docusaurus-plugin-typedoc
  // options: https://github.com/tgreyuk/typedoc-plugin-markdown/blob/master/packages/docusaurus-plugin-typedoc/src/options.ts#L3-L26
  plugins: [
    [
      "./src/plugins/docusaurus-plugin-content-blog",
      {
        showReadingTime: true,
        editUrl:
          "https://github.com/functionless/functionless/edit/main/website/",
      },
    ],
    async function myPlugin(context, options) {
      return {
        name: "docusaurus-tailwindcss",
        configurePostCss(postcssOptions) {
          // Appends TailwindCSS and AutoPrefixer.
          postcssOptions.plugins.push(require("tailwindcss"));
          postcssOptions.plugins.push(require("autoprefixer"));
          return postcssOptions;
        },
      };
    },
    function () {
      return {
        name: "functionless-error-code-docs",
        loadContent: () =>
          // run the compile-error-code-page CLI after typedoc is run by `docusaurus-plugin-typedoc`
          require("./scripts/compile-error-code-page"),
      };
    },
  ],
  stylesheets: [
    "https://fonts.googleapis.com/css2?family=Public+Sans:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap",
    "https://fonts.googleapis.com/css2?family=Inter:wght@100;200;300;400;500;600;700;800;900&display=swap",
    "https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@100;200;300;400;500;600;700;800;900&display=swap",
  ],
  presets: [
    [
      "classic",
      /** @type {import('@docusaurus/theme-classic').Options} */
      ({
        docs: {
          sidebarPath: require.resolve("./sidebars.js"),
          editUrl:
            "https://github.com/functionless/functionless/edit/main/website/",
          remarkPlugins: [require("mdx-mermaid")],
        },
        blog: false,
        theme: {
          customCss: require.resolve("./src/css/custom.css"),
        },
        googleAnalytics: {
          anonymizeIP: true,
          trackingID: "G-PYETWN9YYZ",
        },
      }),
    ],
  ],
  themeConfig:
    /** @type {import('@docusaurus/types').ThemeConfig} */
    ({
      // default page image, override using frontMatter `image`
      // https://docusaurus.io/docs/api/plugins/@docusaurus/plugin-content-docs#markdown-front-matter
      image: "img/logo/logo_dark_icon.png",
      metadata: [
        { property: "og:type", content: "article" },
        { property: "og:image:width", content: "180" },
        { property: "og:image:height", content: "192" },
        {
          property: "og:image:secure_url",
          content: `${url}/img/logo/logo_dark_icon.png`,
        },
      ],
      // light color mode disabled for now
      colorMode: {
        defaultMode: "dark",
        disableSwitch: false,
      },
      prism: {
        additionalLanguages: ["graphql"],
        theme: codeTheme,
      },
      navbar: {
        items: [
          {
            type: "doc",
            docId: "what-is-functionless",
            position: "left",
            label: "Docs",
          },
          { to: "/blog", label: "Blog", position: "left" },
          {
            to: "/team",
            label: "Team",
            position: "left",
          },
          {
            href: "https://discord.gg/VRqHbjrbfC",
            html: '<img src="/img/social/discord.svg" />',
            position: "right",
          },
          {
            href: "https://twitter.com/_functionless",
            html: '<img src="/img/social/twitter.svg" />',
            position: "right",
          },
          {
            href: "https://github.com/functionless/functionless",
            html: '<img src="/img/social/github.svg" />',
            position: "right",
          },
        ],
      },
      footer: {},
    }),
  webpack: {
    jsLoader: (isServer) => ({
      loader: require.resolve("swc-loader"),
      options: {
        jsc: {
          parser: {
            syntax: "typescript",
            tsx: true,
          },
          target: "es2019",
          transform: {
            react: {
              runtime: "automatic",
            },
          },
        },
        module: {
          type: isServer ? "commonjs" : "es6",
        },
      },
    }),
  },
};

module.exports = config;
