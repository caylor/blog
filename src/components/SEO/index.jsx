import React from 'react'
import Helmet from 'react-helmet'

export default ({ isPostSEO, data }) => {
  const siteUrl = 'https://www.caylor.cc'
  const schemaOrgJSONLD = [
    {
      '@context': 'http://schema.org',
      '@type': 'WebSite',
      url: siteUrl,
      name: isPostSEO
        ? data.markdownRemark.frontmatter.title
        : data.site.siteMetadata.title
    }
  ]

  if (isPostSEO) {
    const { fields, frontmatter, excerpt } = data.markdownRemark
    const { title } = frontmatter
    const blogURL = `${siteUrl}${fields.slug}`

    schemaOrgJSONLD.push([
      {
        '@context': 'http://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            item: {
              '@id': blogURL,
              name: title
            }
          }
        ]
      },
      {
        '@context': 'http://schema.org',
        '@type': 'BlogPosting',
        url: blogURL,
        name: title,
        headline: title,
        description: excerpt
      }
    ])
  }

  return (
    <Helmet>
      <meta name="description" content="" />
      <script type="application/ld+json">
        {JSON.stringify(schemaOrgJSONLD)}
      </script>
    </Helmet>
  )
}
