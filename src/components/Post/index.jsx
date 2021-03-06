import React from 'react'
import { Card, CardMedia, CardTitle, CardText } from 'material-ui'
import './post.css'
import material1 from '../../static/material-1.png'
import material2 from '../../static/material-2.png'
import material3 from '../../static/material-3.png'
import material4 from '../../static/material-4.png'
import material5 from '../../static/material-5.png'

import SEO from '../SEO'

export default ({ data }) => {
  const { frontmatter, html } = data.markdownRemark
  const materialRandom = [material1, material2, material3, material4, material5]
  const cover = frontmatter.cover
    ? frontmatter.cover.childImageSharp.resolutions.src
    : materialRandom[Math.floor(Math.random() * 4 + 1)]

  return (
    <div>
      <SEO data={data} isPostSEO />
      <Card>
        <CardMedia
          overlay={<CardTitle title={frontmatter.title} />}
          overlayContentStyle={{ background: 'none' }}
          style={{ height: '280px' }}
        >
          <img src={cover} alt="" height="280" />
        </CardMedia>
        <CardTitle subtitle={frontmatter.date} />
        <CardText
          className="markdown-body"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </Card>
    </div>
  )
}
