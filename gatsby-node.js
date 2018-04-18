/**
 * Implement Gatsby's Node APIs in this file.
 *
 * See: https://www.gatsbyjs.org/docs/node-apis/
 */
const path = require('path')
const slash = require('slash')
const { createFilePath } = require('gatsby-source-filesystem')
const { kebabCase, compact, uniq } = require('lodash')

exports.onCreateNode = ({ node, getNode, boundActionCreators }) => {
    const { createNodeField } = boundActionCreators
    if (node.internal.type === `MarkdownRemark`) {
        const fildNode = getNode(node.parent)
        const pathParsed = path.parse(fildNode.relativePath)
        const slug =
            pathParsed.dir === 'about'
                ? '/about'
                : path.posix.join(
                      '/',
                      pathParsed.dir,
                      kebabCase(node.frontmatter.title),
                      '/'
                  )
        createNodeField({
            node,
            name: `slug`,
            value: slug
        })
    }
}

exports.createPages = ({ graphql, boundActionCreators }) => {
    const { createPage } = boundActionCreators

    return new Promise((resolve, reject) => {
        graphql(`
            {
                allMarkdownRemark {
                    edges {
                        node {
                            fields {
                                slug
                            }
                            frontmatter {
                                title
                                tags
                            }
                        }
                    }
                }
            }
        `).then(result => {
            if (result.errors) {
                return reject(result.errors)
            }

            result.data.allMarkdownRemark.edges
                // .filter(({ node }) => node.fields.slug.startsWith('/blog/'))
                .forEach(({ node }) => {
                    createPage({
                        path: node.fields.slug,
                        component: slash(
                            path.resolve('./src/templates/blog-post.jsx')
                        ),
                        context: {
                            slug: node.fields.slug
                        }
                    })
                })

            result.data.allMarkdownRemark.edges
                .reduce(
                    (tags, { node }) =>
                        compact(uniq(tags.concat(node.frontmatter.tags))),
                    []
                )
                .forEach(tag => {
                    createPage({
                        path: `/tags/${kebabCase(tag)}/`,
                        component: slash(
                            path.resolve('./src/templates/tags-page.jsx')
                        ),
                        context: {
                            tag
                        }
                    })
                })

            resolve()
        })
    })
}
