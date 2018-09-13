import React from 'react'
import Post from '../components/Post'

export default Post

export const query = graphql`
  query BlogPostQuery($slug: String!) {
    markdownRemark(fields: { slug: { eq: $slug } }) {
      fields {
        slug
      }
      frontmatter {
        title
        date
        cover {
          childImageSharp {
            resolutions {
              width
              height
              src
              srcSet
            }
          }
        }
      }
      excerpt
      html
    }
  }
`
