import React from 'react'
import { Avatar, Chip } from 'material-ui'
import SocialPerson from 'material-ui/svg-icons/social/person'
import links from '../data/links'

export default () => {
    return (
        <div style={style.wrapper}>
            {links.map((link, index) => (
                <Chip
                    key={index}
                    labelStyle={style.chipLabel}
                    style={style.chip}
                    onClick={() => window.open(link.link)}
                >
                    {link.avatar ? (
                        <Avatar src={link.avatar} style={style.chipIcon} />
                    ) : (
                        <Avatar
                            icon={<SocialPerson />}
                            style={style.chipIcon}
                        />
                    )}
                    {link.name}
                </Chip>
            ))}
        </div>
    )
}

const style = {
    wrapper: {
        display: 'flex',
        boxSizing: 'content-box',
        flexWrap: 'wrap'
    },
    chip: {
        backgroundColor: '#fff',
        border: '1px solid #D3D3D3',
        borderRadius: 0,
        width: 280,
        height: 50,
        margin: '0 20px 24px 0'
    },
    chipIcon: {
        height: 50,
        width: 50,
        borderRadius: 0
    },
    chipLabel: {
        fontSize: '20px',
        lineHeight: '50px',
        margin: '0 auto'
    }
}
