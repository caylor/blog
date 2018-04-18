import React from 'react'
import {
    Card,
    CardActions,
    CardHeader,
    CardText,
    FlatButton
} from 'material-ui'
import PostList from '../components/PostList'

export default PostList

export const query = graphql`
    query IndexQuery {
        allMarkdownRemark(
            sort: { order: DESC, fields: [frontmatter___date] }
            filter: { fileAbsolutePath: { regex: "/blog/post/" } }
        ) {
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
