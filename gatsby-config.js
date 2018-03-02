module.exports = {
    siteMetadata: {
        title: 'Caylor',
    },
    plugins: [
        'gatsby-plugin-react-helmet',
        {
            resolve: 'gatsby-source-filesystem',
            options: {
                name: 'src',
                path: `${__dirname}/blog/`
            }
        },
        'gatsby-transformer-remark',

        // Parse all images files
        'gatsby-transformer-sharp',
        'gatsby-plugin-sharp',

        'gatsby-plugin-offline',

        // 'gatsby-plugin-feed',
    ],
};
