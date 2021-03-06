module.exports = {
  siteMetadata: {
    title: 'Caylor',
    description: '',
    siteUrl: 'https://www.caylor.cc'
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
    {
      resolve: 'gatsby-transformer-remark',
      options: {
        excerpt_separator: '<!-- excerpt_end -->',
      }
    },

    // Parse all images files
    'gatsby-transformer-sharp',
    'gatsby-plugin-sharp',

    'gatsby-plugin-offline',
    {
      resolve: 'gatsby-plugin-google-analytics',
      options: {
        trackingId: 'UA-115034831-1'
      }
    },
    'gatsby-plugin-feed'
  ]
}
