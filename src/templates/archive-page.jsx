import React from 'react'
import PostList from '../components/PostList'

export default PostList

export const pageQuery = graphql`
    query ArchiveQuery($archive: String) {
        allMarkdownRemark(filter: { frontmatter: { date: { eq: $archive } } }) {
            totalCount
            edges {
                node {
                    fields {
                        slug
                    }
                    id
                    frontmatter {
                        title
                        date
                    }
                    excerpt
                }
            }
        }
    }
`
